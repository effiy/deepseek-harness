# @deepseek-ai/dsh-tool-rag

Model-facing `rag_query` tool that queries YiKnowledge via the YiAi RAG API.

## What it does

Registers a `rag_query` tool that Bot Agents can call to search the team's YiKnowledge knowledge base. The tool sends an HTTP POST to YiAi's `/rag-query` endpoint and formats the returned document chunks as markdown for the model.

## Configuration

All fields are optional; the DSH standard priority chain applies (cordis.yml config > environment variable > default).

| Field | Environment fallback | Default | Description |
|---|---|---|---|
| `baseURL` | `$YIAI_BASE_URL` | `http://localhost:10086` | YiAi RAG API base URL |
| `token` | `$YIAI_TOKEN` | `""` (no auth) | X-Token shared secret for YiAi auth |
| `timeoutMs` | — | `30000` | Per-request timeout in milliseconds |

```yaml
# cordis.yml
- plugin: tool-rag
  config:
    baseURL: "http://localhost:10086"
    token: "$DSH_SECRET_YIAI_TOKEN"
    timeoutMs: 30000
```

## Tool: `rag_query`

Searches YiKnowledge with RAG retrieval (HyDE + hybrid dense/sparse + optional rerank).

**Parameters:**
- `question` (required) — natural-language search query
- `top_k` — number of results (1–20, default 5)
- `scope` — file-path prefix filter, e.g. `"engineer/learn/"`
- `hybrid` — use hybrid retrieval (default `true`)

**Returns:** matching document chunks with file paths, relevance scores, content, and metadata.

## Model Experience

The tool returns grounded knowledge results. The agent is instructed to cite source file paths when referencing specific facts.

## Architecture

This package is a simple Cordis function plugin — no provider seam needed because YiAi is the single RAG backend. HTTP transport uses `undici`.

```
Bot Agent → tool call (rag_query) → HTTP POST /rag-query → YiAi → formatted markdown → Agent
```

## Known Limitations and Deferred Work

- **No retry logic** — transient network errors fail the tool call immediately.
- **No caching** — repeated queries hit YiAi every time.
- **`rag_chat` not yet implemented** — the SSE streaming `/rag-chat` endpoint is deferred to Phase 2.
- **No health check** — `/rag-status` is not called on startup to verify YiAi is reachable.