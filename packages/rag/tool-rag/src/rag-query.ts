/**
 * Model-facing `rag_query` tool that queries YiKnowledge via the YiAi RAG API.
 * Owns schema, validation, prompt guidance, limits, and presentation; the HTTP
 * transport uses `undici` directly (single-backend, no provider seam).
 * @module @deepseek-ai/dsh-tool-rag/rag-query
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolResult } from '@deepseek-ai/dsh-tools'

// ── Constants ──

/** Maximum allowed top_k value. */
const MAX_TOP_K = 20

/** Default number of results to retrieve. */
const DEFAULT_TOP_K = 5

// ── TypeScript types for the YiAi RAG API ──

interface YiAiSource {
  file_path: string
  score: number
  text: string
  title: string
  category: string
  date: string
  authority: string
  rel_time: string
}

interface YiAiRagResponse {
  code: number
  message: string
  data: {
    sources: YiAiSource[]
    error?: string
  }
}

// ── Resolved configuration (captured in closure at apply() time) ──

interface ResolvedConfig {
  baseURL: string
  token: string
  timeoutMs: number
}

// ── Tool arguments ──

interface RagQueryArgs {
  question: string
  top_k?: number
  scope?: string | null
  hybrid?: boolean
}

// ── Output formatting ──

/**
 * Format the YiAi source list as model-facing markdown.
 *
 * @param sources - the sources returned from the RAG query.
 * @returns markdown text listing sources with metadata and chunk content.
 */
function formatSources(sources: readonly YiAiSource[]): string {
  if (sources.length === 0) return 'No relevant results found in YiKnowledge.'

  const parts = sources.map((source, index) => {
    const header = `### [${index + 1}] ${source.title || source.file_path}`
    const meta = [
      `**File**: \`${source.file_path}\``,
      `**Score**: ${source.score.toFixed(3)}`,
      source.category ? `**Category**: ${source.category}` : '',
      source.authority ? `**Authority**: ${source.authority}` : '',
      source.rel_time ? `**Updated**: ${source.rel_time}` : '',
    ].filter(Boolean).join(' | ')
    return `${header}\n${meta}\n\n${source.text}\n`
  })

  return `Found ${sources.length} relevant result${sources.length === 1 ? '' : 's'} from YiKnowledge:\n\n${parts.join('\n---\n\n')}\n\nUse this grounded knowledge to inform your answer. Cite the source file paths above when referencing specific facts.`
}

// ── HTTP transport ──

/**
 * POST a RAG query to the YiAi API.
 *
 * @param resolved - the resolved plugin configuration.
 * @param body - the request body (question, top_k, scope, hybrid, citations).
 * @param signal - cancellation signal.
 * @returns the YiAi response envelope.
 */
async function postRagQuery(
  resolved: ResolvedConfig,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<YiAiRagResponse> {
  const { fetch } = await import('undici')
  const url = `${resolved.baseURL.replace(/\/$/, '')}/rag-query`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (resolved.token.length > 0) {
    headers['X-Token'] = resolved.token
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw new Error(`YiAi RAG query failed: HTTP ${response.status} ${response.statusText}`)
  }

  const json = await response.json() as YiAiRagResponse
  if (json.code !== 0) {
    throw new Error(`YiAi RAG query error (code ${json.code}): ${json.message}`)
  }

  return json
}

// ── Presentation ──

/** Pending-call presentation: a generic card titled by the question. */
function presentCall(args: RagQueryArgs): GenericCallView {
  return { card: 'generic', title: args.question, kind: 'search', rawInput: args.question }
}

/** Completed-call presentation: a generic card with result count. */
function presentResult(args: RagQueryArgs, result: ToolResult): GenericCallView | undefined {
  if (result.isError) return undefined
  const sources = (result.meta as { count: number } | undefined)?.count
  const detail = sources !== undefined ? `${sources} source${sources === 1 ? '' : 's'}` : ''
  return { card: 'generic', title: args.question, kind: 'search', rawInput: `${args.question}${detail ? ` (${detail})` : ''}` }
}

// ── Main export: registration function ──

/**
 * Register the `rag_query` tool and its system-prompt guidance.
 *
 * @param ctx - the plugin context.
 * @param resolved - pre-resolved plugin configuration.
 */
export function applyRagQueryTool(ctx: Context, resolved: ResolvedConfig): void {
  ctx.systemPrompt.section({
    name: 'tool:rag_query',
    order: ctx.systemPrompt.getSectionOrder('TOOL_RAG_QUERY'),
    text: ({ scope }) => ctx.tools.get('rag_query', scope) === undefined
      ? ''
      : 'rag_query searches the YiKnowledge knowledge base via RAG retrieval. Results are grounded in the team\'s documented knowledge with file paths, relevance scores, and metadata. Use this tool when you need authoritative information from the knowledge base. Cite source file paths in your answers.',
  })

  ctx.tools.register(defineTool({
    name: 'rag_query',
    description: 'Search the YiKnowledge knowledge base using RAG retrieval. Returns relevant document chunks with file paths, scores, and metadata. Use this to ground your answers in documented team knowledge.',
    parameters: {
      question: {
        type: 'string',
        required: true,
        description: 'Natural-language search query for the knowledge base.',
      },
      top_k: {
        type: 'integer',
        description: `Number of results to return (1-${MAX_TOP_K}, default ${DEFAULT_TOP_K}).`,
      },
      scope: {
        type: 'string',
        description: 'Limit search to a file-path prefix, e.g. "engineer/learn/". Omit to search all documents.',
      },
      hybrid: {
        type: 'boolean',
        description: 'Use hybrid retrieval (dense vector + BM25 keyword matching). Defaults to true for best coverage.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sources: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                file_path: { type: 'string', required: true },
                score: { type: 'number', required: true },
                text: { type: 'string', required: true },
                title: { type: 'string', required: true },
                category: { type: 'string', required: true },
                date: { type: 'string', required: true },
                authority: { type: 'string', required: true },
                rel_time: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        const typed = value as { sources: readonly YiAiSource[] }
        return [{ type: 'text', text: formatSources(typed.sources) }]
      },
      presentationMeta: (_args, value) => {
        const typed = value as { sources: readonly YiAiSource[] }
        return { count: typed.sources.length }
      },
    },
    timeoutMs: resolved.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(rawArgs, exec) {
      const args = rawArgs as RagQueryArgs

      // Validate top_k bounds
      const topK = args.top_k ?? DEFAULT_TOP_K
      if (!Number.isInteger(topK) || topK < 1 || topK > MAX_TOP_K) {
        throw new Error(`top_k must be an integer between 1 and ${MAX_TOP_K}`)
      }

      const queryBody: Record<string, unknown> = {
        question: args.question,
        top_k: topK,
        citations: true,
      }
      if (args.scope !== undefined && args.scope !== null && args.scope.length > 0) {
        queryBody.scope = args.scope
      }
      if (args.hybrid !== undefined) {
        queryBody.hybrid = args.hybrid
      }

      const response = await postRagQuery(resolved, queryBody, exec.signal)

      return {
        sources: response.data.sources.map((source) => ({
          file_path: source.file_path,
          score: source.score,
          text: source.text,
          title: source.title,
          category: source.category,
          date: source.date,
          authority: source.authority,
          rel_time: source.rel_time,
        })),
      }
    },
    presentCall,
    presentResult: (args, result) => presentResult(args, result),
  }))
}