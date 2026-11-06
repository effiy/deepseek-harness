/**
 * REAL-composition coverage for the /bot/status endpoint: boots a Loader-based
 * composition (real webserver + real agent registry + real session store +
 * bot-status-endpoint) and asserts the unauthenticated route answers the bot
 * roster with CORS headers, follows synthetic agent lifecycle events, and is
 * removed on fiber disposal.
 *
 * The optional `sessionTitle` collaborator is stubbed through `ctx.provide`
 * (the webhook runtime.spec precedent): the real SessionTitleService injects
 * `['sessions', 'sessionProjections']` and derives titles through the
 * projection pipeline, a persistence stack disproportionate to an HTTP
 * endpoint composition. The endpoint reads the collaborator through a single
 * synchronous `get(session)` call, which the stub exercises for the titled,
 * untitled, and empty-title paths.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import type { ModuleLoaderV2 } from '@deepseek-ai/cordis-plugin-loader'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import * as BotStatusEndpoint from '../src/index.ts'

const ENDPOINT = '@deepseek-ai/dsh-host-bot-status-endpoint'

let roots: { ctx: Context; root: string }[] = []

afterEach(async () => {
  const loaded = roots
  roots = []
  await Promise.all(loaded.map(async ({ ctx, root }) => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }))
})

/** Let queued cordis tasks and microtasks settle before the next step. */
async function settle(ms = 0): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

/** Titles served by the stub sessionTitle collaborator, keyed by session id. */
const STUB_TITLES: Record<string, { title: string } | undefined> = {
  'titled-bot': { title: 'Botty' },
  'empty-title-bot': { title: '' },
}

interface BootOptions {
  /** Agents registered through the real registry before the endpoint loads. */
  seeds?: { id: string; status?: AgentStatus }[]
  /** Provide the stub sessionTitle collaborator on the root context. */
  withTitleStub?: boolean
}

interface Booted {
  port: number
  ctx: Context
  /** The registered seed agents, for use in lifecycle event payloads. */
  seeds: Agent[]
}

/**
 * Boot a Loader composition with webserver + agent registry, register the seed
 * agents through the real registry, then load bot-status-endpoint so its
 * bootstrap scan observes them.
 */
async function boot(options: BootOptions = {}): Promise<Booted> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bot-status-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    "- name: '@deepseek-ai/dsh-agent'",
    '',
  ].join('\n'))

  const ctx = new Context()
  roots.push({ ctx, root })
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(SessionStore)
  if (options.withTitleStub === true) {
    ctx.provide('sessionTitle', {
      get: (session: { id: string }) => STUB_TITLES[String(session.id)],
    } as never)
  }
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', WebServer],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    [ENDPOINT, BotStatusEndpoint],
  ])
  // The Loader's create() path only calls internal.import (health.spec
  // precedent); the remaining ModuleLoaderV2 members exist for the typed
  // assignment and fail loudly if ever reached.
  const loadCache: ModuleLoaderV2['loadCache'] = Object.assign(new Map(), {
    get: (): undefined => undefined,
    set: (): never => {
      throw new Error('the test composition does not cache module jobs')
    },
    has: (): boolean => false,
  })
  const stubModuleLoader: ModuleLoaderV2 = {
    version: 'v2',
    loadCache,
    async import(specifier: string): Promise<unknown> {
      const resolved = modules.get(specifier)
      if (resolved === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return resolved
    },
    register(): void {
      throw new Error('the test composition does not register modules')
    },
    async getOrCreateModuleJob(): Promise<never> {
      throw new Error('the test composition does not create module jobs')
    },
    resolveSync(): never {
      throw new Error('the test composition does not resolve specifiers')
    },
    async load(): Promise<never> {
      throw new Error('the test composition does not load URLs')
    },
  }
  ctx.loader.internal = stubModuleLoader
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()

  // Seed through the real registry so the endpoint's bootstrap scan and the
  // roster both reflect genuinely registered agents.
  const seeds: Agent[] = []
  for (const seed of options.seeds ?? []) {
    const sessionId = SessionId(seed.id)
    const agent = {
      id: sessionId,
      session: ctx.sessions.create(sessionId),
      status: seed.status ?? 'idle',
    } satisfies Pick<Agent, 'id' | 'session' | 'status'> as Agent
    ctx.agents.register(agent)
    seeds.push(agent)
  }
  await settle()

  await ctx.loader.create({ name: ENDPOINT })
  await ctx.loader.await()
  return { port: ctx.webServer.port, ctx, seeds }
}

/** Fetch the endpoint and decode the JSON roster. */
async function fetchBots(port: number): Promise<Record<string, unknown>[]> {
  const res = await fetch(`http://127.0.0.1:${String(port)}/bot/status`)
  expect(res.status).toBe(200)
  const body = await res.json() as { bots: Record<string, unknown>[] }
  return body.bots
}

describe('GET /bot/status', () => {
  it('answers 200 with an empty roster and CORS headers without authentication', async () => {
    const { port } = await boot()
    const res = await fetch(`http://127.0.0.1:${String(port)}/bot/status`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(await res.json()).toEqual({ bots: [] })
  })

  it('seeds agents already registered when the endpoint activates', async () => {
    const { port } = await boot({ seeds: [{ id: 'seed-bot' }] })
    const bots = await fetchBots(port)
    expect(bots).toHaveLength(1)
    const [entry] = bots
    if (entry === undefined) throw new Error('expected exactly one roster entry')
    expect(entry.botId).toBe('seed-bot')
    expect(entry.sessionId).toBe('seed-bot')
    expect(entry.state).toBe('idle')
    expect(entry.detail).toBe('Idle')
    const updatedAt = entry.updatedAt
    if (typeof updatedAt !== 'string') throw new Error('roster entry lacks an updatedAt timestamp')
    expect(new Date(updatedAt).toISOString()).toBe(updatedAt)
  })

  it('answers OPTIONS preflight with 204 and CORS headers', async () => {
    const { port } = await boot()
    const res = await fetch(`http://127.0.0.1:${String(port)}/bot/status`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
    expect(res.headers.get('access-control-allow-headers')).toBe('content-type')
  })

  it('rejects non-GET methods with 405', async () => {
    const { port } = await boot()
    const res = await fetch(`http://127.0.0.1:${String(port)}/bot/status`, { method: 'POST' })
    expect(res.status).toBe(405)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(await res.text()).toBe('Method Not Allowed')
  })

  it('tracks agent/status transitions for uncached and cached agents', async () => {
    const { port, ctx } = await boot()
    const sessionId = SessionId('live-bot')
    const agent = {
      id: sessionId,
      session: ctx.sessions.create(sessionId),
      status: 'idle',
    } satisfies Pick<Agent, 'id' | 'session' | 'status'> as Agent

    // First transition for an uncached agent builds a fresh entry.
    ctx.emit('agent/status', { agent, status: 'running' })
    let bots = await fetchBots(port)
    expect(bots).toHaveLength(1)
    expect(bots[0]).toMatchObject({ botId: 'live-bot', state: 'running', detail: 'Running' })

    // A second transition updates the cached entry in place.
    ctx.emit('agent/status', { agent, status: 'idle' })
    bots = await fetchBots(port)
    expect(bots).toHaveLength(1)
    expect(bots[0]).toMatchObject({ botId: 'live-bot', state: 'idle', detail: 'Idle' })
  })

  it('adds an agent on agent/created exactly once', async () => {
    const { port, ctx } = await boot()
    const sessionId = SessionId('created-bot')
    const agent = {
      id: sessionId,
      session: ctx.sessions.create(sessionId),
      status: 'idle',
    } satisfies Pick<Agent, 'id' | 'session' | 'status'> as Agent

    ctx.emit('agent/created', { agent, source: 'startup' })
    ctx.emit('agent/created', { agent, source: 'startup' })
    const bots = await fetchBots(port)
    expect(bots).toHaveLength(1)
    expect(bots[0]).toMatchObject({ botId: 'created-bot', state: 'idle' })
  })

  it('removes an agent on agent/disposed', async () => {
    const { port, ctx, seeds } = await boot({ seeds: [{ id: 'doomed-bot' }] })
    expect(await fetchBots(port)).toHaveLength(1)

    const seed = seeds[0] as Agent
    ctx.emit('agent/disposed', { agent: seed })
    expect(await fetchBots(port)).toEqual([])
  })
})

describe('session title resolution', () => {
  it('prefers a non-empty session title and falls back to the agent id', async () => {
    const { port } = await boot({
      withTitleStub: true,
      seeds: [{ id: 'titled-bot' }, { id: 'plain-bot' }, { id: 'empty-title-bot' }],
    })
    const bots = await fetchBots(port)
    expect(bots).toEqual([
      expect.objectContaining({ botId: 'Botty', sessionId: 'titled-bot' }),
      expect.objectContaining({ botId: 'plain-bot', sessionId: 'plain-bot' }),
      expect.objectContaining({ botId: 'empty-title-bot', sessionId: 'empty-title-bot' }),
    ])
  })
})

describe('HMR safety', () => {
  it('is removed when the fiber disposes', async () => {
    const { port, ctx } = await boot({ seeds: [{ id: 'seed-bot' }] })

    // The route works before disposal.
    expect((await fetch(`http://127.0.0.1:${String(port)}/bot/status`)).status).toBe(200)

    // Dispose the endpoint fiber and verify the route is gone.
    const loaded = [...ctx.loader.entries()].find(item => item.options.name === ENDPOINT)
    const fiber = loaded?.fiber
    if (fiber === undefined) throw new Error('bot-status-endpoint fiber not found in the loader')
    await fiber.dispose()
    // The webserver re-reads its route table on the next request; a short
    // settle lets the disposed fiber's effect unwind.
    await settle(50)

    const after = await fetch(`http://127.0.0.1:${String(port)}/bot/status`)
    // Without a fallback handler, the webserver answers 404 for unmatched routes.
    expect(after.status).toBe(404)
  })
})
