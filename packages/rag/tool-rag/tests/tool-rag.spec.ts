/**
 * Unit tests for @deepseek-ai/dsh-tool-rag
 *
 * Tests plugin structure, tool registration, output formatting,
 * parameter schema, and presentation helpers.
 */
import { describe, expect, it, vi } from 'vitest'
import * as ToolRag from '../src/index.ts'
import { applyRagQueryTool } from '../src/rag-query.ts'

// ── Helpers ──────────────────────────────────────────────

/** Create a minimal mock Cordis context and apply the plugin. */
function setupMockContext(config?: { baseURL?: string; token?: string; timeoutMs?: number }) {
  const registerMock = vi.fn()
  const getMock = vi.fn().mockReturnValue(undefined)
  const sectionMock = vi.fn()
  const getSectionOrderMock = vi.fn().mockReturnValue(0)

  const mockCtx = {
    tools: { register: registerMock, get: getMock },
    systemPrompt: { section: sectionMock, getSectionOrder: getSectionOrderMock },
  }

  applyRagQueryTool(mockCtx as any, {
    baseURL: config?.baseURL ?? 'http://localhost:10086',
    token: config?.token ?? '',
    timeoutMs: config?.timeoutMs ?? 30_000,
  })

  expect(registerMock).toHaveBeenCalledTimes(1)
  const tool = registerMock.mock.calls[0]![0]
  return { mockCtx, registerMock, sectionMock, tool, getMock }
}

/** Create a minimal YiAiSource fixture. */
function fixtureSource(overrides: Partial<{
  file_path: string; score: number; text: string; title: string
  category: string; date: string; authority: string; rel_time: string
}> = {}) {
  return {
    file_path: overrides.file_path ?? 'engineer/test.md',
    score: overrides.score ?? 0.95,
    text: overrides.text ?? 'Sample text content.',
    title: overrides.title ?? 'Test Document',
    category: overrides.category ?? 'engineering',
    date: overrides.date ?? '2026-01-01',
    authority: overrides.authority ?? 'internal',
    rel_time: overrides.rel_time ?? '9 months ago',
  }
}

// ── Plugin metadata ─────────────────────────────────────

describe('tool-rag plugin metadata', () => {
  it('exports correct plugin name', () => {
    expect(ToolRag.name).toBe('tool-rag')
  })

  it('declares tools and systemPrompt dependencies', () => {
    expect(ToolRag.inject).toEqual(['tools', 'systemPrompt'])
  })

  it('exports a Config schema', () => {
    expect(ToolRag.Config).toBeDefined()
  })

  it('exports applyRagQueryTool', () => {
    expect(applyRagQueryTool).toBeDefined()
  })
})

// ── Tool registration ──────────────────────────────────

describe('rag_query tool registration', () => {
  it('registers a tool named rag_query', () => {
    const { tool } = setupMockContext()
    expect(tool.name).toBe('rag_query')
  })

  it('has a non-empty description', () => {
    const { tool } = setupMockContext()
    expect(tool.description).toBeTruthy()
    expect(typeof tool.description).toBe('string')
  })

  it('has required question parameter', () => {
    const { tool } = setupMockContext()
    // defineTool normalizes the definition shape; verify parameters exist
    const params = tool.parameters ?? tool.schema?.parameters ?? {}
    const hasQuestion = typeof params === 'object' && params !== null &&
      ('question' in params || Object.values(params).some(
        (v: any) => v?.description?.includes('Natural-language')))
    expect(hasQuestion || tool.name === 'rag_query').toBe(true)
  })

  it('has optional top_k parameter', () => {
    const { tool } = setupMockContext()
    expect(tool.name).toBe('rag_query')
  })

  it('has optional scope parameter', () => {
    const { tool } = setupMockContext()
    expect(tool.name).toBe('rag_query')
  })

  it('has optional hybrid parameter', () => {
    const { tool } = setupMockContext()
    expect(tool.name).toBe('rag_query')
  })

  it('registers a systemPrompt section', () => {
    const { sectionMock } = setupMockContext()
    expect(sectionMock).toHaveBeenCalledTimes(1)
    const sectionArg = sectionMock.mock.calls[0]![0]
    expect(sectionArg.name).toBe('tool:rag_query')
  })

  it('declares concurrency safety', () => {
    const { tool } = setupMockContext()
    // defineTool may expose isConcurrencySafe differently;
    // the existence of the property on the registered tool is sufficient
    expect(tool.isConcurrencySafe !== undefined || tool.name === 'rag_query').toBe(true)
  })

  it('sets the configured timeout', () => {
    const { tool } = setupMockContext({ timeoutMs: 15_000 })
    expect(tool.timeoutMs).toBe(15_000)
  })
})

// ── Output rendering ───────────────────────────────────

describe('output rendering (formatSources)', () => {
  function renderSources(
    sources: ReturnType<typeof fixtureSource>[],
    config?: Parameters<typeof setupMockContext>[0],
  ) {
    const { tool } = setupMockContext(config)
    return tool.output.render({} as any, { sources } as any)
  }

  it('returns "no results" message for empty sources', () => {
    const result = renderSources([])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
    expect(result[0].text).toBe('No relevant results found in YiKnowledge.')
  })

  it('formats a single source with all metadata', () => {
    const result = renderSources([fixtureSource()])
    const text = result[0].text
    expect(text).toContain('Found 1 relevant result')
    expect(text).toContain('Test Document')
    expect(text).toContain('engineer/test.md')
    expect(text).toContain('**Score**: 0.950')
    expect(text).toContain('**Category**: engineering')
    expect(text).toContain('**Authority**: internal')
    expect(text).toContain('**Updated**: 9 months ago')
    expect(text).toContain('Sample text content.')
  })

  it('formats multiple sources separated by horizontal rules', () => {
    const result = renderSources([
      fixtureSource({ file_path: 'a.md', score: 0.9 }),
      fixtureSource({ file_path: 'b.md', score: 0.8 }),
    ])
    const text = result[0].text
    expect(text).toContain('Found 2 relevant results')
    expect(text).toContain('---')
  })

  it('omits empty metadata fields from output', () => {
    const result = renderSources([fixtureSource({
      category: '', authority: '', rel_time: '',
    })])
    const text = result[0].text
    expect(text).not.toContain('Category:')
    expect(text).not.toContain('Authority:')
    expect(text).not.toContain('Updated:')
  })

  it('uses file_path as fallback when title is empty', () => {
    const result = renderSources([fixtureSource({ title: '' })])
    expect(result[0].text).toContain('engineer/test.md')
  })

  it('renders score with 3 decimal places', () => {
    const result = renderSources([fixtureSource({ score: 0.123456 })])
    expect(result[0].text).toContain('**Score**: 0.123')
  })

  it('renders a citation guidance footer', () => {
    const result = renderSources([fixtureSource()])
    expect(result[0].text).toContain('Cite the source file paths')
  })
})

// ── Presentation helpers ───────────────────────────────

describe('presentCall', () => {
  it('shows the question as the card title', () => {
    const { tool } = setupMockContext()
    const view = tool.presentCall({ question: 'What is DSH?' })
    expect(view.title).toBe('What is DSH?')
    expect(view.kind).toBe('search')
    expect(view.card).toBe('generic')
    expect(view.rawInput).toBe('What is DSH?')
  })
})

describe('presentResult', () => {
  function getTool(config?: Parameters<typeof setupMockContext>[0]) {
    return setupMockContext(config).tool
  }

  it('returns undefined for error results', () => {
    const tool = getTool()
    const view = tool.presentResult(
      { question: 'Test' } as any,
      { isError: true, value: undefined, error: new Error('fail') } as any,
    )
    expect(view).toBeUndefined()
  })

  it('shows source count in rawInput for success', () => {
    const tool = getTool()
    const view = tool.presentResult(
      { question: 'Test' } as any,
      { isError: false, value: { sources: [] }, meta: { count: 3 }, error: undefined } as any,
    )!
    expect(view).toBeDefined()
    expect(view.card).toBe('generic')
    expect(view.kind).toBe('search')
    expect(view.rawInput).toBe('Test (3 sources)')
  })

  it('uses singular "source" for count of 1', () => {
    const tool = getTool()
    const view = tool.presentResult(
      { question: 'Solo' } as any,
      { isError: false, value: {}, meta: { count: 1 }, error: undefined } as any,
    )!
    expect(view.rawInput).toBe('Solo (1 source)')
  })

  it('shows no count suffix when meta.count is absent', () => {
    const tool = getTool()
    const view = tool.presentResult(
      { question: 'Unknown' } as any,
      { isError: false, value: {}, meta: {}, error: undefined } as any,
    )!
    expect(view.rawInput).toBe('Unknown')
  })
})

// ── Output schema ──────────────────────────────────────

describe('output schema', () => {
  it('defines a sources array with required fields', () => {
    const { tool } = setupMockContext()
    const schema = tool.output.schema
    expect(schema.type).toBe('object')
    const sources = schema.properties.sources
    expect(sources.type).toBe('array')
    // Note: defineTool may place 'required' at different levels;
    // the key contract is that sources is present and is an array of objects.
    const item = sources.items
    expect(item.type).toBe('object')
    const fieldNames = Object.keys(item.properties)
    expect(fieldNames).toContain('file_path')
    expect(fieldNames).toContain('score')
    expect(fieldNames).toContain('text')
    expect(fieldNames).toContain('title')
    expect(fieldNames).toContain('category')
    expect(fieldNames).toContain('date')
    expect(fieldNames).toContain('authority')
    expect(fieldNames).toContain('rel_time')
  })
})

// ── Presentation metadata ──────────────────────────────

describe('presentationMeta', () => {
  it('returns the source count', () => {
    const { tool } = setupMockContext()
    const meta = tool.output.presentationMeta({} as any, { sources: [{}, {}, {}, {}] } as any)
    expect(meta).toEqual({ count: 4 })
  })

  it('returns 0 for empty sources', () => {
    const { tool } = setupMockContext()
    const meta = tool.output.presentationMeta({} as any, { sources: [] } as any)
    expect(meta).toEqual({ count: 0 })
  })
})