# @deepseek-ai/dsh-bot-status-public

Public HTTP endpoint exposing live DSH bot statuses for external consumers (e.g. YiVad).

## What it does

- Listens to `agent/status` Cordis events to track every bot's lifecycle state (`idle` / `running`).
- Maintains an in-memory cache keyed by agent session id.
- Exposes `GET /api/bot-states` — an unauthenticated HTTP endpoint returning JSON with CORS headers.

## Response format

```json
{
  "bots": [
    {
      "botId": "mac·企鹅",
      "state": "running",
      "detail": "Running",
      "updatedAt": "2026-11-04T01:30:00.000Z"
    }
  ]
}
```

## Usage

Add the plugin to a DSH profile:

```yaml
# cordis.patch.yml
- id: bot-status-public
  plugin: '@deepseek-ai/dsh-bot-status-public'
```

The endpoint is then available at `http://<host>:<port>/api/bot-states`.

## Dependencies

Requires the standard DSH base services: `webServer`, `agents`. Optionally reads `sessionTitle` for human-readable bot names; falls back to session ids when the title service is absent.

## Architecture

```
DSH Agent Registry
  │  agent/status 事件 (idle | running)
  ▼
bot-status-public plugin
  │  内存 Map<sessionId, BotStatusEntry>
  │  GET /api/bot-states (public, CORS)
  ▼
YiVad botStatusService.ts
  │  fetchBotStates() → 30s polling
  ▼
BotStatusBadge component
```