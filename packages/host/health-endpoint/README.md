---
title: "@deepseek-ai/dsh-host-health-endpoint"
tags: []
category: "host"
created: 2026-11-04
source: internal
type: index
status: stable
lifecycle: active
---

## 💡 概述

注册一个无需认证的 `GET /health` 路由，返回包含进程状态的 JSON 响应，供负载均衡器和编排器进行就绪探测。

## ⚡ 功能

- 路径：`/health`
- 方法：`GET`（HEAD 也会匹配 `exact` 路由的行为）
- 响应：`200` `{ "status": "ok", "uptime": <秒数> }`
- 不经过 `connection` 认证层

### 限制

- 该端点仅报告进程级状态；不包含深层服务就绪检查、数据库连接或模型提供方可用性。

## 📊 指标

无，因为该包注册一个 HTTP 路由，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 🚀 快速开始

在 bundle/cordis.patch.yml 中添加：

```yaml
- id: health-endpoint
  name: '@deepseek-ai/dsh-host-health-endpoint'
```

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-host-health-endpoint