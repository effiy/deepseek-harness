/**
 * Smoke coverage for the /health endpoint: boots a Loader-based composition
 * (webserver + health-endpoint) and asserts the route answers 200 without
 * authentication.
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
import * as HealthEndpoint from '../src/index.ts'

let roots: { ctx: Context; root: string }[] = []

afterEach(async () => {
  const loaded = roots
  roots = []
  await Promise.all(loaded.map(async ({ ctx, root }) => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }))
})

/** Boot a Loader composition with webserver + health-endpoint, return the port. */
async function boot(): Promise<{ port: number; ctx: Context }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-health-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    "- name: '@deepseek-ai/dsh-host-health-endpoint'",
    '',
  ].join('\n'))

  const ctx = new Context()
  roots.push({ ctx, root })
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', WebServer],
    ['@deepseek-ai/dsh-host-health-endpoint', HealthEndpoint],
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

describe('GET /health', () => {
  it('answers 200 with status and uptime without authentication', async () => {
    const { port } = await boot()
    const res = await fetch(`http://127.0.0.1:${String(port)}/health`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    const body = await res.json() as Record<string, unknown>
    expect(body.status).toBe('ok')
    expect(typeof body.uptime).toBe('number')
    expect(body.uptime).toBeGreaterThan(0)
  })

  it('is removed when the fiber disposes (HMR safety)', async () => {
    const { port, ctx } = await boot()

    // Route works before disposal.
    expect((await fetch(`http://127.0.0.1:${String(port)}/health`)).status).toBe(200)

    // Dispose the health-endpoint fiber and verify the route is gone.
    const healthFiber = [...ctx.loader.entries()]
      .find(entry => entry.options.name === '@deepseek-ai/dsh-host-health-endpoint')?.fiber
    healthFiber?.dispose()
    // The webserver re-reads its route table on the next request; a short
    // settle lets the disposed fiber's effect unwind.
    await new Promise(resolve => setTimeout(resolve, 50))

    const after = await fetch(`http://127.0.0.1:${String(port)}/health`)
    // Without a fallback handler, the webserver answers 404 for unmatched routes.
    expect(after.status).toBe(404)
  })
})
