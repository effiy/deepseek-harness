---
title: "@deepseek-ai/dsh-session-telemetry-otel"
tags: []
category: "session"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

适配器注入 `otel`；[共享 OTel 插件](../../telemetry/otel/README.zh.md) 创建其独立 Session 日志通道。授权、脱敏、身份、scope 版本、配置和关闭期限仍由本包负责。

`dsh-session-telemetry-otel` 仅在新的显式反馈后通过 OTel JS SDK 导出会话记录，适用于所有用户和提供方，包括 `deepseek-official`。`FEEDBACK_ONLY` 释放截至该反馈的权威日志前缀，包含上下文；后续记录等待下一次显式反馈。`DISABLED` 不构造传输。定时批处理可完成已授权的上传，无需另一次用户交互或模型调用。部署方负责脱敏规则。

---

## ⚡ 功能

### 限制

这些限制说明 SDK 行为在何处起主导作用、导出保证止于何处。它们是当前包约束。

- **上游实验性源码树**——`@opentelemetry/sdk-logs` 从上游实验性源码树发布；SDK API 的变动落在[共享 OTel 插件](../../telemetry/otel/README.zh.md)，而 seam 约定不动。
- **真实 collector 行为属于 SDK 导出器**——身份验证、TLS、限流及其他真实 OTLP 部署行为遵循上游 SDK，不由本包自有兼容层处理。
- **尽力交接**——新冷快照以及重启后的新反馈提交可能重复前缀；接收方按 Session id、格式版本和事件 seq 去重。没有持久化 outbox、投递水位、自动重试承诺或采集端接受保证。OTel 与需显式启用的 DeepSeek API 路径可能重叠。撤回导出删除事件，不是远端擦除。

- **后端可用性**——本插件禁用或卸载期间提交的反馈会记录在本地，但恢复插件不会自动重放。捕获要求订阅方保持挂载直到观察到提交；在冷写入尚未完成时卸载，可能错过其 flush 后通知。

---

## 📊 指标

无，因为该后端把 seam 记录转发进 OTel SDK 流水线，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释后端的组合方式；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

后端负责反馈授权、身份和关闭。共享 OTel 服务负责通道创建、字节和条数调度、记录构造、JSON 传输、压缩与重试。Resource 身份携带 `APP_IDENTITY` 中的 `service.name` / `service.version` 以及匿名 `user.id`；scope 保留本包的名称和版本。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：模式解析、fail-closed 校验、SDK 流水线接线、协调器组装、关闭截止时间 |

### 捕获接线

后端按需捕获历史，由新的自身反馈事件或已提交的冷会话快照触发。私有 reporter 串行发送排队 HTTP 请求，即使监测期限已触发也不会重叠；外层关闭期限停止剩余队列。不额外暴露 flush 入口。

### 字段映射

每条采集记录向 `SessionLogReporter` 提供单独复制的事件信封和脱敏后的载荷；序列化保留可选的呈现元数据及事件序号和时间。反馈授权整个尚未交接的前缀，而不只是反馈载荷。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：模式解析、fail-closed 校验、SDK 流水线接线、协调器组装、关闭截止时间 |

---

## 🔗 资源

当后端约定不够用时阅读以下页面。它们从它所实现的 seam 逐步进入子系统参考与它所上报的身份。

- [会话遥测 seam](../session-telemetry/README.zh.md)——捕获约定、记录词汇与脱敏 waterfall。
- [会话遥测子系统](../../../docs/subsystems/session-telemetry.zh.md)——能力拆分与类型声明。
- [匿名用户身份](../../identity/anonymous-user-id/README.zh.md)——作为 OTel Resource `user.id` 上报的 id。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-session-telemetry-otel)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- id: sessionTelemetry-otel
  name: '@deepseek-ai/dsh-session-telemetry-otel'
  config:
    mode: FEEDBACK_ONLY       # optional; defaults to FEEDBACK_ONLY
    shutdownTimeoutMillis: 3000 # optional; defaults to 3000
    exporter:                # explicit SDK transport settings
      url: https://collector.example.com/v1/logs
      headers:
        authorization: !!js `Bearer ${process.env.OTLP_TOKEN}`
    processor: {}            # optional; byte/count batching and per-request watchdog
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `mode` | `FEEDBACK_ONLY` | 共享策略：`FEEDBACK_ONLY` 或 `DISABLED` |
| `exporter.url` | 上传模式必填 | 完整 OTLP 日志端点；必须能解析为 `http(s)` |
| `exporter`, `processor` | — | SDK 传输及字节/条数聚合；不继承环境中的头部和 TLS 身份。agent 工厂负责返回实例的设置，包括 keepAlive |
| `shutdownTimeoutMillis` | `3,000` | 所有排队 HTTP 请求的外层期限；到期后停止剩余排队发送 |
| `maxRequestBytes` | `4,000,000` | gzip 前完整 OTLP JSON 请求的最大字节数；只能调低 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-telemetry-otel
