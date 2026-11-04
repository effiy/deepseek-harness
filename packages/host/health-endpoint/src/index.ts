/**
 * Una authenticated GET /health endpoint: answers a JSON readiness/uptime body
 * without going through the composition's browser authentication layer.
 *
 * Load balancers and orchestrators call this path; authentication would prevent
 * them from determining whether the process is alive. The route registers on
 * the composition's `webServer` service and does not gate on `connection`.
 *
 * @module @deepseek-ai/dsh-host-health-endpoint
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Stable Cordis plugin name. */
export const name = 'health-endpoint'

/** Services required before the health route can be claimed. */
export const inject = ['webServer'] as const

/**
 * Register the `/health` exact route, which answers immediately with a 200
 * JSON body carrying process uptime.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/health',
    handler: (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }))
    },
  }), 'health-endpoint: GET /health')
}
