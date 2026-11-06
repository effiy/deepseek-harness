---
title: "@deepseek-ai/dsh-host-metrics-endpoint"
tags: []
category: "host"
created: 2026-11-06
source: internal
type: index
status: stable
lifecycle: active
---

## 💡 概述

注册一个无需认证的 `GET /metrics` 路由，以 Prometheus 文本格式（version 0.0.4）返回进程级指标，供 Prometheus 抓取。

## ⚡ 功能

- 路径：`/metrics`，不经过 `connection` 认证层
- 指标：
  - `process_uptime_seconds` — 进程运行时长
  - `process_resident_memory_bytes` — 常驻内存
  - `nodejs_heap_size_used_bytes` / `nodejs_heap_size_total_bytes` / `nodejs_external_memory_bytes` — V8 堆
  - `nodejs_eventloop_delay_mean_seconds` — 两次抓取之间的事件循环平均延迟
  - `process_cpu_user_seconds_total` / `process_cpu_system_seconds_total` — 累计 CPU
  - `dsh_sessions_active` — 活跃会话数（仅当 session store 已加载）

### 限制

- 事件循环延迟直方图在每次抓取后重置，报告的均值覆盖两次抓取之间的区间；抓取间隔决定了延迟样本窗口。
- 仅进程级指标；不桥接 OTel meter provider（DSH 的 telemetry 通道有意不启用 SDK self-observability metering）。

## 📊 指标

本包自身即指标暴露端点。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 🚀 快速开始

在 bundle/cordis.patch.yml 中添加：

```yaml
- id: metrics-endpoint
  name: '@deepseek-ai/dsh-host-metrics-endpoint'
```

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-host-metrics-endpoint
