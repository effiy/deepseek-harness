/**
 * Unauthenticated GET /bot/status endpoint: answers live bot roster and
 * running/idle status without going through the browser authentication layer.
 * Consumed by YiVad's BotStatusBadge dashboard; CORS headers enable
 * cross-origin polling.
 *
 * Pattern follows @deepseek-ai/dsh-host-health-endpoint.
 *
 * @module @deepseek-ai/dsh-host-bot-status-endpoint
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type { AgentStatus, Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Stable Cordis plugin name. */
export const name = 'bot-status-endpoint'

/** Services required for route registration and agent tracking. */
export const inject = ['webServer', 'agents']

/** One cached bot status entry served by the endpoint. */
interface BotStatusEntry {
  /** Human-readable bot name (session title). */
  botId: string
  /** Live agent/session identity. */
  sessionId: string
  /** Current lifecycle state: idle or running. */
  state: AgentStatus
  /** Human-readable status detail. */
  detail: string
  /** ISO 8601 timestamp of the last status change. */
  updatedAt: string
}

/** Endpoint response envelope. */
interface BotStatesResponse {
  bots: BotStatusEntry[]
}

/** Default detail messages keyed by AgentStatus. */
const DEFAULT_DETAIL: Record<AgentStatus, string> = {
  idle: 'Idle',
  running: 'Running',
}

/** CORS headers applied to every response. */
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

/**
 * Public bot-status HTTP endpoint.
 *
 * Registers `GET /bot/status` on the webserver without authentication,
 * returning JSON with current bot states and CORS headers.
 *
 * @param ctx - plugin context carrying the webserver and agents services.
 */
export function apply(ctx: Context): void {
  // Resolve the optional session-title service once at plugin init.
  const titleService = ctx.get('sessionTitle') as
    | { get(session: { id: string }): { title: string } | undefined }
    | undefined

  function resolveBotId(agent: Agent): string {
    if (titleService !== undefined) {
      const snapshot = titleService.get(agent.session)
      if (snapshot !== undefined && snapshot.title.length > 0) return snapshot.title
    }
    return String(agent.id)
  }

  function buildEntry(agent: Agent, status: AgentStatus): BotStatusEntry {
    return {
      botId: resolveBotId(agent),
      sessionId: String(agent.id),
      state: status,
      detail: DEFAULT_DETAIL[status],
      updatedAt: new Date().toISOString(),
    }
  }

  const cache = new Map<string, BotStatusEntry>()

  function track(agent: Agent): void {
    cache.set(String(agent.id), buildEntry(agent, agent.status))
  }

  // Bootstrap: seed the cache with every agent already live at activation.
  for (const agent of ctx.agents.list()) track(agent)

  // Listeners on the plugin's own root context receive ALL agents' transitions.
  const disposeStatus = ctx.on('agent/status', ({ agent, status }) => {
    const id = String(agent.id)
    const existing = cache.get(id)
    cache.set(id, {
      ...(existing ?? buildEntry(agent, status)),
      state: status,
      detail: DEFAULT_DETAIL[status],
      updatedAt: new Date().toISOString(),
    })
  })

  const disposeCreated = ctx.on('agent/created', ({ agent }) => {
    if (!cache.has(String(agent.id))) track(agent)
  })

  const disposeDisposed = ctx.on('agent/disposed', ({ agent }) => {
    cache.delete(String(agent.id))
  })

  // Register the public route and keep it alive for the plugin's lifetime.
  const disposeRoute = ctx.webServer.register({
    kind: 'exact',
    path: '/bot/status',
    handler(_req: IncomingMessage, res: ServerResponse): void {
      // OPTIONS preflight for CORS.
      if (_req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS)
        res.end()
        return
      }

      if (_req.method !== 'GET') {
        res.writeHead(405, { ...CORS_HEADERS, 'content-type': 'text/plain' })
        res.end('Method Not Allowed')
        return
      }

      const body: BotStatesResponse = {
        bots: [...cache.values()],
      }
      const json = JSON.stringify(body)

      res.writeHead(200, {
        ...CORS_HEADERS,
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(Buffer.byteLength(json)),
      })
      res.end(json)
    },
  })

  // Tear down listeners and route when the plugin unloads.
  ctx.effect(() => () => {
    disposeStatus()
    disposeCreated()
    disposeDisposed()
    disposeRoute()
  }, 'bot-status-endpoint: lifecycle')
}
