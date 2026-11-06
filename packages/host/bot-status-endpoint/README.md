---
title: "@deepseek-ai/dsh-host-bot-status-endpoint"
tags: []
category: "host"
created: 2026-11-06
source: internal
type: index
status: stable
lifecycle: active
---

## 💡 概述

注册一个无需认证的 `GET /bot/status` 路由，返回当前 Bot 列表与运行状态（`idle` / `running`）的 JSON 响应，并附带 CORS 头，供外部面板（YiVad BotStatusBadge）跨域轮询。

## ⚡ 功能

- 路径：`/bot/status`
- 方法：`GET` 返回 `200` `{ "bots": [{ "botId", "sessionId", "state", "detail", "updatedAt" }] }`；`OPTIONS` 返回 `204` 预检；其余方法返回 `405`
- 状态来源：监听 `agent/created` / `agent/status` / `agent/disposed` 事件维护内存缓存；插件激活时对已存在的 agent 做一次种子扫描
- `botId` 优先取 `sessionTitle` 服务的标题（即 Bot 名），缺失时回退为 agent id
- 所有响应附带 `access-control-allow-origin: *` 等 CORS 头
- 不经过 `connection` 认证层（webserver `exact` 路由直连）

## 📊 指标

无，因为该包注册一个 HTTP 路由，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 🚀 快速开始

在 bundle/cordis.patch.yml 中添加：

```yaml
- id: bot-status-endpoint
  name: '@deepseek-ai/dsh-host-bot-status-endpoint'
```

## Known Limitations and Deferred Work

- 状态缓存是进程内存态：插件加载前已结束的 agent 转换不会补录，重启后缓存从零开始，依赖后续事件重建。
- `detail` 目前是状态直译（`Idle` / `Running`）；更细粒度的运行详情（当前工具、轮次进度）需要 agent-loop 侧事件扩展，未实施。
- 无鉴权即无按调用方隔离：任何能访问端口的客户端都可读取 Bot 名单，部署到非本机网络前需要外层代理收敛。

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-host-bot-status-endpoint
