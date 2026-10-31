---
title: "@deepseek-ai/dsh-host-product-telemetry-otel"
tags: []
category: "host"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

将选定的产品使用事件发送到 OTLP/HTTP 接收服务。事件包含名称、字符串摘要、发生时间，以及标量或单层对象属性。挂载插件不会自动采集信息；应用需要显式提交每个事件。发送采用尽力而为方式，不代表数据已入仓。

---

## ⚡ 功能

### 限制

发送和采集受以下能力限制。

- 调用方拥有事件选择、渲染进程到宿主的传输以及获准使用的标识属性。
- 队列仅存在于内存；队列溢出、网络故障和进程退出可能丢失事件。没有持久发件箱或入仓确认。
- SDK 按记录条数而非编码字节数分批。调用方必须确保记录不超过接收服务的 4 MB 限制，并选择接收服务适用的批次大小。
- 不自动脱敏调用方选择的字符串。本包不决定产品告知或同意策略。

---

## 📊 指标

无，因为插件仅发送显式分析记录，不提供模型上下文。

#### KV Cache 影响

无；提交事件不会改变模型请求。

## 已知限制与待办工作

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

适配器注入 `otel`，通过 `ctx.otel.createEventReporter()` 创建独立的普通事件通道。[共享 OTel 插件](../../telemetry/otel/README.zh.md) 负责传输和 SDK 聚合；本适配器负责埋点配置及关闭取消期限。不安装全局 OTel provider。

[`src/index.ts`](src/index.ts) 负责配置与提交。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

## 延伸阅读

- [产品埋点](../../../docs/subsystems/product-telemetry.zh.md)——消费方类型与服务参考。
- [会话上报](../../session/session-telemetry-otel/README.zh.md)——独立的、由反馈授权的 Session 上报。
- [测试策略](../../../docs/testing.zh.md)——Loader 组合与网络测试夹具。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-otel'
- name: '@deepseek-ai/dsh-host-product-telemetry-otel'
  config:
    endpoint: https://dsh-otel-collector.deepseeksvc.com/v1/logs
    serviceName: deepseek-harness
    serviceVersion: !!js process.env.DSH_APP_VERSION
    compression: gzip
    scheduledDelayMillis: 30000
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `endpoint` | `https://dsh-otel-collector.deepseeksvc.com/v1/logs` | 完整 HTTP(S) 日志地址 |
| `serviceName`, `serviceVersion` | 必填 | OTel resource 中的应用标识 |
| `channel` | `dsh_otel_report` | 接收服务的 `x-channel` 请求头 |
| `compression` | SDK 环境变量 | `gzip` 或 `none`；省略时遵循 OTel 压缩环境变量 |
| `maxExportBatchSize`, `maxQueueSize` | `512`, `2048` | 记录条数上限；批次大小不能超过队列大小 |
| `scheduledDelayMillis` | `30000` | 不满批次时的发送间隔 |
| `timeoutMillis` | `15000` | Exporter HTTP 发送与重试的超时时间 |
| `exportTimeoutMillis` | `20000` | Processor 批次导出的超时时间 |
| `shutdownTimeoutMillis` | `21000` | 排空期限；超时取消待完成的导出并提示可能丢失数据 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-product-telemetry-otel
