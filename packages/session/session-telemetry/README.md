---
title: "@deepseek-ai/dsh-session-telemetry"
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

会话遥测让部署方发送会话活动的有序副本用于上报，同时保留权威会话日志。部署方选择一个上报后端，并可在投递前脱敏每个外发副本；如果没有脱敏规则，捕获的数据将原样离开进程。交接以非阻塞方式完成，因此上报不会延迟会话处理。投递采用尽力而为方式；如果进程崩溃，队列中的记录可能丢失。

---

## ⚡ 功能

### 限制

这些限制定义部署方能得到的投递与数据保护保证。它们是当前包约束。

- **尽力而为的投递**——游标标记的是已交接而非已投递；在重载窗口内被拆除的会话无法重新收养，崩溃时留在后端队列中的内容会丢失。持久化 outbox（spool、每 sink 游标、at-least-once）推迟到有部署方提出明确的崩溃丢失要求时再实现。
- **不内置脱敏规则**——未挂载 `sessionTelemetry/record` 监听器时，记录以捕获时的原样离开进程，包括文件内容或命令输出中内嵌的任何凭据；向共享 collector 导出的部署方自行负责其规则集。
- **按需脱敏使用当前状态**——未捕获的事件只存在于权威会话日志中；后续的 `captureSession()` 会使用当时挂载的策略，深拷贝并脱敏其当前值，且不存在捕获时的遥测快照或持久化的捕获前 spool。

---

## 📊 指标

无，因为该 seam 观察会话流并把脱敏后的副本交给外部；它不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释捕获设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

捕获包负责完整事件捕获、脱敏和交接游标。脱敏规则必须保留 `sourceEvent` 才能通过 OTel 上传；返回不含它的新记录会阻止该事件上传并产生诊断。复制的 envelope 不含 `data`，数据仅由 `body` 携带。OTel 后端负责字节/条数调度并使用 SDK 传输和重试。[历史恢复遥测决策记录](../../../.agents/notes/archived/feature/2026-07-23-session-telemetry-otel-revival.md) 说明捕获和脱敏依据。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | Service Definition：`SessionTelemetryBackend`/`SessionTelemetrySink` 约定、记录词汇、`session-telemetry/record` waterfall 声明 |
| [`src/coordinator.ts`](src/coordinator.ts) | 捕获：live 监听器、生命周期本地 on-demand 回放、脱敏、handoff 游标、异常隔离 |

### 捕获流程

实时捕获通过组合 fiber 的 effect 注册 Session 事件、刷新提示、关闭标记与 agent/error 观察器。按需捕获只注册释放 effect，并按历史策略读取请求的权威日志前缀。同步处理器隔离失败，避免影响 agent loop（智能体循环）或其他监听器。

### handoff 游标

模块级 `WeakMap<Session, seq>` 记录已经移交的最高序号，而不是已送达的最高序号。再次接管同一对象时从该游标之后继续。采集从 `firstLifecycleSeq` 开始：新 fork 包含子会话自有的标记与 fork 结束事件；恢复的 Session 排除已存储前缀，包括先前的子会话轮次。显式 `includeHistory: true` 会让尚未移交的对象从 seq 0 开始，包括恢复或 fork 历史。Backend 负责采集授权；已有存储历史本身不构成授权，OTel backend 等待新的显式反馈。接收方通过 `(session.id, session.format_version, event.seq)` 对重复记录去重。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | Service Definition：`SessionTelemetryBackend`/`SessionTelemetrySink` 约定、记录词汇、`session-telemetry/record` waterfall 声明 |
| [`src/coordinator.ts`](src/coordinator.ts) | 捕获：live 监听器、生命周期本地 on-demand 回放、脱敏、handoff 游标、异常隔离 |

---

## 🔗 资源

当 seam 约定不够用时阅读以下页面。它们从随附后端逐步进入子系统参考与决策证据。

- [OpenTelemetry 遥测后端](../session-telemetry-otel/README.zh.md)——部署方加载的随附后端，含模式与导出器配置。
- [会话遥测子系统](../../../docs/subsystems/session-telemetry.zh.md)——能力拆分与类型声明。
- [历史会话遥测复活决策](../../../.agents/notes/archived/feature/2026-07-23-session-telemetry-otel-revival.md)——理由、权衡与被否决的替代方案。
- [会话包映射](../README.zh.md)——相邻的持久化、投影、标题与遥测包。

---

## 🚀 快速开始

选择并挂载后端

只加载一个后端插件；它把捕获协调器与投递流水线注册为 `ctx.sessionTelemetry`。重复加载会抛出异常。必需的 [`sharing` 成员](#the-sharing-disclosure) 报告部署模式，不代表会话准入或投递。只有在未挂载任何遥测服务时，消费方才可报告「未配置」。`/feedback` 命令确认记录，不读取此策略。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-telemetry
