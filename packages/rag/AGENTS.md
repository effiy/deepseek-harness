# AGENTS.md — RAG Packages

These rules supplement the package conventions in [packages/AGENTS.md](../AGENTS.md).

- **The RAG tool calls a trusted internal service (YiAi).** The YiAi RAG API endpoint is a same-machine or same-network internal service, not a public internet resource. The `X-Token` shared secret is carried as a request header; unlike the `web-fetch-http` provider, URL redirects from this internal endpoint are not expected and do not require the same redirect-rejection policy.
- **Single-backend, no provider seam.** The tool owns HTTP transport directly through `undici`. A provider seam is deferred until multiple RAG backends need to coexist.