/**
 * Unauthenticated GET /metrics endpoint: answers Prometheus text-format
 * process metrics without going through the composition's browser
 * authentication layer.
 *
 * Prometheus scrapers call this path; authentication would prevent them from
 * collecting metrics. The route registers on the composition's `webServer`
 * service and does not gate on `connection`. Metrics are process-scoped
 * (uptime, memory, CPU, event-loop delay) plus one optional DSH gauge
 * (`dsh_sessions_active`) read through `ctx.get('sessions')` when the session
 * store is loaded.
 *
 * @module @deepseek-ai/dsh-host-metrics-endpoint
 */

import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session'

/** Stable Cordis plugin name. */
export const name = 'metrics-endpoint'

/** Services required before the metrics route can be claimed. */
export const inject = ['webServer'] as const

/**
 * Render the current metrics snapshot in Prometheus text exposition format
 * (version 0.0.4). Each gauge/counter line carries its HELP and TYPE header.
 *
 * @param ctx - the composing context; `sessions` is read optionally through
 * `ctx.get` so the endpoint also serves on compositions without a session
 * store.
 * @param histogram - the event-loop delay histogram; its mean is reported in
 * seconds.
 * @returns the complete response body.
 */
export function renderMetrics(ctx: Context, histogram: IntervalHistogram): string {
  const memory = process.memoryUsage()
  const cpu = process.cpuUsage()
  const lines: string[] = []
  const gauge = (metric: string, help: string, value: number): void => {
    lines.push(`# HELP ${metric} ${help}`)
    lines.push(`# TYPE ${metric} gauge`)
    lines.push(`${metric} ${String(value)}`)
  }
  const counter = (metric: string, help: string, value: number): void => {
    lines.push(`# HELP ${metric} ${help}`)
    lines.push(`# TYPE ${metric} counter`)
    lines.push(`${metric} ${String(value)}`)
  }
  gauge('process_uptime_seconds', 'Process uptime in seconds.', process.uptime())
  gauge('process_resident_memory_bytes', 'Resident set size in bytes.', memory.rss)
  gauge('nodejs_heap_size_used_bytes', 'V8 heap used in bytes.', memory.heapUsed)
  gauge('nodejs_heap_size_total_bytes', 'V8 heap total in bytes.', memory.heapTotal)
  gauge('nodejs_external_memory_bytes', 'V8 external memory in bytes.', memory.external)
  // An empty histogram (first scrape right after enable, or right after a
  // reset with no completed events) has mean NaN; report 0 instead of an
  // unparsable value.
  const eventLoopMeanSeconds = Number.isFinite(histogram.mean) ? histogram.mean / 1e9 : 0
  gauge('nodejs_eventloop_delay_mean_seconds', 'Mean event-loop delay over the interval since the previous scrape, in seconds.', eventLoopMeanSeconds)
  counter('process_cpu_user_seconds_total', 'Total user CPU time in seconds.', cpu.user / 1e6)
  counter('process_cpu_system_seconds_total', 'Total system CPU time in seconds.', cpu.system / 1e6)
  const sessions = ctx.get('sessions')
  if (sessions !== undefined) {
    gauge('dsh_sessions_active', 'Number of live sessions in the session store.', sessions.list().length)
  }
  return `${lines.join('\n')}\n`
}

/**
 * Register the `/metrics` exact route. Each scrape reads live process
 * counters; the event-loop histogram resets per scrape so the reported mean
 * covers the interval between scrapes.
 */
export function apply(ctx: Context): void {
  const histogram = monitorEventLoopDelay({ resolution: 20 })
  histogram.enable()
  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'exact',
      path: '/metrics',
      handler: (_req, res) => {
        const body = renderMetrics(ctx, histogram)
        histogram.reset()
        res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' })
        res.end(body)
      },
    })
    return () => {
      disposeRoute()
      histogram.disable()
    }
  }, 'metrics-endpoint: GET /metrics')
}
