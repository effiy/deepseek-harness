# DeepSeek Harness

**An all-plugin agent harness built on [Cordis](https://github.com/cordis-land/cordis).** Compose agents from swappable plugins — model adapters, tools, sandboxes, persistence, and the agent loop itself — through configuration, not code patches.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen)](https://nodejs.org/)
[![Python SDK](https://img.shields.io/badge/python-3.10%2B-blue)](python/)

---

## What is DeepSeek Harness?

DeepSeek Harness (DSH) is the runtime that powers the DeepSeek AI agent experience — it runs both the chat interface at [chat.deepseek.com](https://chat.deepseek.com) and the desktop application. Every part of the product is a [Cordis plugin](docs/cordis-primer.md): the model adapter, the tool registry, the session log, and the agent loop itself are all replaceable from configuration. There is no privileged core to patch.

The project is a TypeScript monorepo of **50+ packages** plus a Python SDK, with a rich documentation site of 30+ articles in English and Chinese.

### Key Features

- **Plugin architecture** — swap model providers, tools, filesystems, sandboxes, and persistence backends without forking
- **Multi-profile runtime** — `web` (GUI), `headless` (CLI), `sdk` (JSON-RPC), `acp` (automation protocol), all from one binary
- **DeepSeek API integration** — first-class support for DeepSeek models with real-API testing
- **Rich tool ecosystem** — shell execution, browser automation, LSP integration, file operations, MCP servers, and more
- **Durable sessions** — append-only event log with versioned persistence, fork/resume, and migration support
- **Desktop application** — packaged Electron app with signed runtime and plugin management
- **Python SDK** — native Python client that embeds the DSH runtime for seamless cross-language integration

---

## Quick Start

### Prerequisites

- **Node.js** 22.19+ or 24+
- **pnpm** (Corepack-enabled, pinned at 11.28.5)
- **Git** 2.26+

### Install

```bash
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run typecheck   # verify setup
```

### Run

```bash
# Web GUI (development)
pnpm run dev:web

# Headless mode
pnpm dsh --profile headless "Explain quantum computing in one paragraph"

# Desktop application
pnpm run dev:desktop
```

Set `DEEPSEEK_API_KEY` in your environment for real-model inference.

### Test

```bash
pnpm run test              # unit tests
pnpm run test:coverage     # CI coverage gate (per-file 100%)
pnpm run test:e2e          # real-API tests (self-skip without key)
pnpm run test:snapshot     # recorded session replay
```

---

## Architecture

DeepSeek Harness is built on [Cordis](docs/cordis-primer.md): plugins contribute services, typed events, and reversible effects to a shared context. This makes every capability a seam — swap one provider and the whole product adapts.

### Profiles and Bundles

A running `dsh` is a plugin tree composed at boot from ordered layers:

- **Profile** — named composition of bundles plus user patches (ships: `web`, `headless`, `sdk`, `sdk-minimal`, `acp`)
- **Bundle** — distribution format for Cordis config rows and the code they mount
- **Patch** — YAML overlay that replaces or inserts rows by id, allowing full customization

### Core Subsystems

| Subsystem | Role |
|-----------|------|
| Agent Loop | Model request/response cycle, turn management, tool orchestration |
| Session Log | Append-only event log, model history projection, fork/resume |
| Tool Registry | Scoped registration with guarded execution pipeline |
| LLM Adapters | Provider seam for DeepSeek, Ollama, and other models |
| Filesystem | Pluggable FS providers with sandbox confinement |
| Subprocess | Child-process management with SSH execution backends |
| MCP | External tool servers via Model Context Protocol |

Read the [architecture overview](docs/architecture.md) for the full map.

---

## Repository Layout

```
packages/      @deepseek-ai/dsh-<pkg> workspaces (50+ packages in core/, api/, llm/, shell/, …)
python/        Python SDK and runtime
native/        Node.js native addon source
apps/          Desktop (Electron), Web (Vite), CLI
docs/          Architecture, development, testing, cookbook (EN + ZH)
benchmarks/    Performance gates
.agents/       Agent workflows and decision records
website/       VitePress documentation site
```

---

## Documentation

| Document | Content |
|----------|---------|
| [Architecture](docs/architecture.md) | Plugin tree, profiles, core packages, turn flow, seams |
| [Development Guide](docs/development.md) | Setup, daily workflow, CI organization |
| [Testing Policy](docs/testing.md) | Test tiers, real-API policy, snapshot testing |
| [Cordis Primer](docs/cordis-primer.md) | Cordis framework introduction |
| [Config Catalog](docs/config-catalog.md) | All configuration fields (generated) |
| [Tool Catalog](docs/tool-catalog.md) | All built-in tools and their schemas |
| [Cookbook](docs/cookbook/) | Step-by-step guides for adding packages, tools, LLM adapters |
| [API Gateway](docs/api-gateway.md) | Remote BFF protocol |
| [Capability Seams](docs/capability-seams.md) | Service definition/provider/consumer roles |
| [Extension Cookbook](docs/cookbook/extension-cookbook.md) | How to extend every seam |

Full docs at the [documentation site](https://deepseek-ai.github.io/deepseek-harness/).

---

## Contributing

DeepSeek Harness is under active development. While we cannot accept external pull requests at this stage, there are many ways to contribute:

- Report issues in [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)
- Create plugins and share them with the `dsh-plugin` topic
- Write blog posts and how-to guides
- Answer questions in the community

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

> **Note for contributors:** This repository requires per-file 100% test coverage on `packages/*/*/src` (see [testing policy](docs/testing.md)). Public APIs are pre-stable; breaking changes are recorded in upgrade guides.

---

## Brand Guidelines

"DeepSeek Harness" is a registered trademark. Use the abbreviated "DSH" for community project names. See [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md) for full guidelines.

---

## License

MIT © DeepSeek