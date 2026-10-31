/**
 * Cordis plugin that registers the `rag_query` tool so Bot Agents can search
 * YiKnowledge through the YiAi RAG API.
 *
 * @module @deepseek-ai/dsh-tool-rag
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { applyRagQueryTool } from './rag-query.ts'

export { applyRagQueryTool }

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-rag'

/** Services required by this plugin. */
export const inject = ['tools', 'systemPrompt']

/** Default YiAi RAG API base URL. */
const DEFAULT_YIAI_BASE_URL = 'http://localhost:10086'

/** Default request timeout (ms). */
const DEFAULT_RAG_QUERY_TIMEOUT_MS = 30_000

/** Plugin config: all fields are optional with sensible defaults. */
export interface Config {
  /** YiAi RAG API base URL (default: $YIAI_BASE_URL or http://localhost:10086). */
  baseURL?: string
  /** X-Token shared secret for YiAi auth (default: $YIAI_TOKEN or empty — no auth). */
  token?: string
  /** Per-request timeout in milliseconds (default: 30000). */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  baseURL: z.string(),
  token: z.string().role('secret'),
  timeoutMs: z.number().default(DEFAULT_RAG_QUERY_TIMEOUT_MS),
})

/** Complete config after schemastery applies every field default. */
type ResolvedConfig = Required<Config>

/**
 * Resolve configuration with the DSH standard priority chain:
 * cordis.yml config > environment variable > hardcoded constant.
 *
 * @param ctx - the plugin context.
 * @param config - the validated config from cordis.yml.
 * @returns the resolved values.
 */
function resolveConfig(ctx: Context, config: Config): ResolvedConfig {
  const env = launchEnvironmentOf(ctx)
  return {
    baseURL: config.baseURL
      ?? env.get('YIAI_BASE_URL')?.value
      ?? DEFAULT_YIAI_BASE_URL,
    token: config.token
      ?? env.get('YIAI_TOKEN')?.value
      ?? '',
    timeoutMs: config.timeoutMs ?? DEFAULT_RAG_QUERY_TIMEOUT_MS,
  }
}

/**
 * Register the RAG query tool. The tool is registered through `ctx.tools.register`
 * and its disposer is fiber-scoped, so cleanup is automatic on plugin dispose.
 */
export function apply(ctx: Context, config: Config): void {
  // schemastery has already filled defaulted fields; resolve the rest.
  const resolved = resolveConfig(ctx, config as Config)

  applyRagQueryTool(ctx, {
    baseURL: resolved.baseURL,
    token: resolved.token,
    timeoutMs: resolved.timeoutMs,
  })
}