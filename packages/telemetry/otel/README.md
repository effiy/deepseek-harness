---
title: "@deepseek-ai/dsh-otel"
tags: []
category: "telemetry"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

挂载一个 `otel` 服务即可创建普通事件和 Session 日志上报通道。每个通道拥有独立的 exporter、resource、instrumentation scope 和队列。仅挂载不会创建传输、身份或发送数据。业务调用方负责授权、脱敏、字段选择及通道销毁。

---

## ⚡ 功能

### 限制

通道提供尽力而为的纯内存投递，具有以下限制。

- 调用方负责同意、脱敏、resource 身份、renderer 到 host 的 RPC 及外层关闭期限。
- 队列溢出、Session 事件超限、传输失败和进程退出可能丢失记录。不提供持久 outbox 或仓库确认。
- 普通事件通道按条数聚合；调用方必须选择适合 collector 的事件和批次大小。

---

## 📊 指标

无，因为服务只投递调用方选择的记录，不改变模型上下文。

#### KV Cache 影响

无；上报不改变模型请求。

## 已知限制与后续工作

---

## 🏛️ 设计

`src/index.ts` 注册服务；`event-log.ts` 负责普通事件的 SDK 聚合；`session-log.ts` 负责字节和条数调度；`transport.ts` 提供 Session 的 SDK JSON HTTP delegate，并持有共享的 exporter 指标记录器（不接收 meter provider，不记录任何指标）；`event-transport.ts` 使用 Got 实现可取消的普通事件 HTTP 请求和重试等待，序列化与导出计数仍由 SDK 负责。不安装全局 OTel provider；接受的 exporter 选项排除上游的 `selfObsMeterProvider`，Session processor 也只接受它实现的聚合字段，因此 exporter 和 Session processor 的自观测指标都不会被记录。Session processor 对每条记录只计量一次，按保守大小组包，并在每次回调后等待 SDK 并发队列清理完成才发送下一请求。

组合测试覆盖独立通道和服务移除；适配器测试覆盖依赖 fiber 清理与反馈授权。

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [OTel 子系统](../../../docs/subsystems/otel.zh.md) — 服务职责与 API。
- [产品适配器](../../host/product-telemetry-otel/README.zh.md) — 显式埋点策略与配置。
- [Session 适配器](../../session/session-telemetry-otel/README.zh.md) — 反馈授权和上传限制配置。

---

## 🚀 快速开始

base bundle 挂载 `@deepseek-ai/dsh-otel`。独立组合必须在注入 `otel` 的调用方之前挂载它。普通埋点调用 `ctx.otel.createEventReporter(options)`，完整 Session 事件调用 `ctx.otel.createSessionLogReporter(options)`。选项显式提供 endpoint、scope、resource attributes、队列设置和诊断回调；服务本身没有部署默认值或自动采集策略。

返回的通道由调用方持有。普通事件 `shutdown(signal)` 在传入信号中止时取消请求和重试等待

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-otel
