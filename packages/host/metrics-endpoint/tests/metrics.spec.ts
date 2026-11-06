/**
 * Smoke coverage for the /metrics endpoint: boots a Loader-based composition
 * (webserver + metrics-endpoint, optionally + session store) and asserts the
 * Prometheus text surface — status, content type, metric families, the
 * optional sessions gauge, and route removal on fiber disposal.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import SessionStore from '@deepseek-ai/dsh-session'
import * as MetricsEndpoint from '../src/index.ts'

let roots: { ctx: Context; root: string }[] = []

afterEach(async () => {
  const loaded = roots
  roots = []
  await Promise.all(loaded.map(async ({ ctx, root }) => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }))
})

/** Boot a Loader composition with webserver + metrics-endpoint (+ sessions), return the port. */
async function boot(withSessions: boolean): Promise<{ port: number; ctx: Context }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-metrics-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    ...(withSessions ? ["- name: '@deepseek-ai/dsh-session'"] : []),
    "- name: '@deepseek-ai/dsh-host-metrics-endpoint'",
    '',
  ].join('\n'))

  const ctx = new Context()
  roots.push({ ctx, root })
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', WebServer],
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-host-metrics-endpoint', MetricsEndpoint],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  return { port: ctx.webServer.port, ctx }
}

describe('GET /metrics', () => {
  it('answers 200 Prometheus text with the process metric families', async () => {
    const { port } = await boot(false)
    const res = await fetch(`http://127.0.0.1:${String(port)}/metrics`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(res.headers.get('content-type')).toContain('version=0.0.4')
    const body = await res.text()
    for (const metric of [
      'process_uptime_seconds',
      'process_resident_memory_bytes',
      'nodejs_heap_size_used_bytes',
      'nodejs_heap_size_total_bytes',
      'nodejs_external_memory_bytes',
      'nodejs_eventloop_delay_mean_seconds',
      'process_cpu_user_seconds_total',
      'process_cpu_system_seconds_total',
    ]) {
      expect(body).toContain(`# TYPE ${metric} `)
      expect(body).toMatch(new RegExp(`^${metric} [0-9.e+-]+$`, 'm'))
    }
    // Without a session store the DSH gauge stays absent.
    expect(body).not.toContain('dsh_sessions_active')
  })

  it('reports dsh_sessions_active when the session store is loaded', async () => {
    const { port } = await boot(true)
    const before = await (await fetch(`http://127.0.0.1:${String(port)}/metrics`)).text()
    expect(before).toMatch(/^dsh_sessions_active 0$/m)
  })

  it('is removed when the fiber disposes (HMR safety)', async () => {
    const { port, ctx } = await boot(false)
    expect((await fetch(`http://127.0.0.1:${String(port)}/metrics`)).status).toBe(200)

    const metricsFiber = [...ctx.loader.entries()]
      .find(entry => entry.options.name === '@deepseek-ai/dsh-host-metrics-endpoint')?.fiber
    await metricsFiber?.dispose()

    const after = await fetch(`http://127.0.0.1:${String(port)}/metrics`)
    // Without a fallback handler, the webserver answers 404 for unmatched routes.
    expect(after.status).toBe(404)
  })
})
