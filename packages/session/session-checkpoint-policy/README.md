---
title: "@deepseek-ai/dsh-session-checkpoint-policy"
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

将本包与会话持久化后端配合使用，可在模型请求之前、顶层工具可能产生外部副作用之前以及下一 agent 步骤开始之前持久记录工作。每个检查点之后，即使发生崩溃，系统也能从已存储的请求、工具调用、响应与结果恢复工作，而不会丢失这些工作。检查点失败按失败即阻止原则处理：持久写入成功前，模型适配器或顶层工具正文不会运行。本包没有配置，也不添加提示词或工具 schema；未完成的 Assistant 流保持瞬态，而中断的工具调用会以未知结果恢复，不会自动重试。

---

## ⚡ 功能

### 适用场景

为每个可能被中断的持久化 agent 选择它——已记录工具调用与其结果之间、或模型请求与其响应之间的崩溃，正是本策略遏制的那类故障。不带它加载后端是有效的但更弱：仍位于后端批处理窗口内或尚未完成的写入可能丢失。当没有任何组件持久化会话，或专用部署刻意替换检查点调度时，跳过本策略。

### 限制

这些限制界定本策略持久性保证的终点。它们是当前包约束，不是任务积压。

- **持久记录执行意图，而非恰好一次副作用**——策略记录的是调用已分派，而非其外部副作用已完成。当提供方支持时，有副作用的工具应将 `exec.callId` 作为幂等键转发。
- **活跃模型 attempt 内没有检查点**——硬崩溃可能丢失尚未进入持久 `assistant/message` 或 `assistant/attempt` settlement 的瞬态 Assistant frame。
- **记录未知结果，而非自动重试**——没有结果的持久调用无法证明其外部副作用是否完成，因此恢复记录未知结果，而不是自动重试。

---

## 📊 指标

### 中断调用

#### 模型看到什么

插件不添加提示词或工具 schema。工具检查点后、结果前的硬崩溃会留下持久的未匹配调用；会话恢复提供由 `dsh-session` 负责的模型可见 `TOOL_OUTCOME_UNKNOWN` 结果。该消息允许重试只读或幂等工作，并要求对可能有副作用的调用验证状态或请求用户确认。

#### Token 影响

成功检查点不添加 token，也不改变请求。恢复会添加一条短工具结果消息，以平衡中断的 transcript（文本记录）。

#### KV Cache 影响

修复结果追加在可重用前缀之后，因此不会使较早的缓存条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节说明该策略如何接入 loop 与持久化 seam；可观察约定已在[使用本包](#use-this-package)中说明。

### 设计理念

该插件只是对三个 seam 的纯监听组合，自身没有状态：它包装 `llm/stream`，使下游流只在活动会话中缓冲的请求事件已持久后构造；在预执行策略与防护之后包装 `tools/execute`，使顶层工具正文只在已记录调用已持久后运行；并监听 `agent/pre-step`，在派生请求前持久化前一响应/结果批次。会话存储的 flush 是共享持久性屏障；并发工具检查点经它串行化，不会产生重复序列号。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`apply` 安装三个检查点监听器 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`apply` 安装三个检查点监听器 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从持久性模型逐步进入它所加入的 seam 与随产品交付的后端。

- [会话持久化子系统](../../../docs/subsystems/persistence.zh.md)——每个后端共享的 flush 检查点、批处理窗口与崩溃恢复。
- [会话包映射](../README.zh.md)——相邻的持久化、投影、标题与遥测包。
- [会话持久化 seam](../session-persistence/README.zh.md)——本策略经由其刷新的 `ctx.sessionPersistence` 服务。
- [JSONL 持久化后端](../session-persistence-jsonl/README.zh.md)——本策略通常与之一起加载的随产品交付后端。

---

## 🚀 快速开始

### 配置

```yaml
- id: session-persistence
  name: '@deepseek-ai/dsh-session-persistence-jsonl'

- id: session-checkpoints
  name: '@deepseek-ai/dsh-session-checkpoint-policy'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`apply` 安装三个检查点监听器 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-checkpoint-policy
