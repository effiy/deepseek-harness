---
title: "@deepseek-ai/dsh-tool-jobs"
tags: []
category: "jobs"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用 `dsh-tool-jobs`，可通过 `job_output`、`job_list` 与 `job_kill` 检查和控制后台命令、PTY 工作与 subagent。读取可在配置的超时内等待，列表结果标识各任务的 kind 与状态，而取消只有在工作停止后才结算。归属明确的工作完成时，agent（智能体）会收到会话内通知：繁忙的 agent 在下一步收到通知，空闲的 agent 则由 follow-up 轮次唤醒。配置控制等待上限、完成投递与可选的连续唤醒上限。流输出仅供单一读取方消费，待领通知无法在所有者释放后存活。

---

## ⚡ 功能

### 限制

这些限制说明工具何时不合适。它们是当前包约束，不是任务积压。

- **落在 driver 退休窗口内的结算仍会让通知搁浅**——在轮次循环最后一次检查 inbox 与 driver 提交 idle 相位之间，所有者读起来仍是繁忙，因此通知走注入且无人唤醒。steering（中途引导）存在同样的问题；修复它属于 `agent-loop`。
- **已花掉的唤醒预算不会随时间恢复**——设置了 `maxConsecutiveWakes` 时，只有用户撰写的输入才能补充，因此预算耗尽的无人值守 agent 要等到其他原因开启下一轮时才收走剩余通知，且客户端不会显示有通知在等待。
- **待领于空闲所有者的通知无法在该所有者释放后存活**——释放时的取消会清空未领取的 inbox，日志保留插入/取消这一对作为记录。
- **模型读取只有单一消费方**——独立观察者使用注册表非消耗的 `readAt`（Web 客户端的 `job.follow`），而不是这些工具。
- **无 owner 的任务没有会话隔离**——外部调用方必须提供策略或避开这些任务。

---

## 📊 指标

### 系统提示词

#### 模型看到什么

该插件注册 scope 中的每次请求都包含以下指引。按 agent scope 过滤工具时，可能会隐藏工具，却不会移除独立注册的提示词区段。

##### 后台任务指引

```markdown
Track every background job id you start. You are notified in-session when a job finishes — do not busy-poll or sleep on one; keep working on independent steps and do not duplicate a running job's work. Before giving a final answer, collect every still-relevant job with job_output (set wait: true only when you are genuinely blocked on it), and job_kill jobs that stopped mattering.
```

#### Token 影响

激活期间，每次请求都会产生少量固定的输入 token 开销。

#### KV Cache 影响

只要插件 scope 与指引文本不变，前缀就保持稳定。激活或释放可能使从该提示词区段起的复用失效。

### 工具 schema

#### 模型看到什么

该工具集可见时，会看到生成的 [`job_output`、`job_list` 和 `job_kill` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-jobs)。

#### Token 影响

工具可见时，每次请求都会产生固定的 schema token 开销。

#### KV Cache 影响

只要工具定义与可见性不变，前缀就保持稳定。注册生命周期或 scope 限制可能使从第一个发生变化的 schema token 起的复用失效。

### 结果与通知

#### 模型看到什么

读取会返回输出或 `(no new output)`，随后是 `[status: <status>]` 和可选 detail。空列表返回 `(no background jobs)`。kill 返回 `requested cancellation of job <id>` 或现有终止状态。模型尚未收走且有所有者归属的完成使用上述通知。

#### Token 影响

结果与通知在压缩（compaction）前保留于父级历史。流读取不会重复已消费的输出；生产方提供的 `outputLimitBytes` 会限制每次完整读取或通知。在 `wakeup` 下，抵达空闲所有者的通知还会额外买下一次用户并未要求的模型请求，其数量仅在设置了 `maxConsecutiveWakes` 时按所有者封顶；抵达繁忙所有者的通知则只是给它已经在支付的那一轮加一步。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释工具背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

- **与 kind 无关的控制。** 同一套三个工具读取、列出和取消每种生产方 kind 的任务——bash、PTY——因为它们都通过通用的 `ctx.jobs` 运行时注册。
- **投递归本插件，收件人归注册表。** 插件决定未报告的完成如何到达所有者——注入繁忙的一步，或唤醒空闲所有者的一轮——而注册表把每次结算路由给其所有者 scope 链所能抵达的监听器，因此某个 preset 下的挂载永远看不到另一个 preset 的 agent，无论挂载了多少 preset，一个 agent 每次完成都只读到一条通知。
- **生产方自有的输出上限。** 生产方提供 `outputLimitBytes` 时，完整的模型侧结果——输出读取、终止 kill 快照或完成通知——会在添加状态与通知元数据之后被施加上限；省略该字段的生产方保持无界行为。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：工具注册、结算订阅与模型杀停集合、提示词区段、输出上限 |
| [`src/render.ts`](src/render.ts) | 面向模型的渲染：公共投影、状态行与消耗式增量（stdout、`[stderr]` 段、丢失输出提示） |

### 输出上限

`job_output` 与 `job_kill` 会在策略运行前于前置的 pre-execute 监听器中捕获调用方可见任务，因此生产方上限适用于完整渲染结果。`job_output` 在策略保留默认渲染时保持其输出／状态拆分，对输出尾部与 `[status: ...]` 后缀设界；其他单文本结果——拒绝、短路、规范化工具或流水线失败、替换与阻止——按单个文本设界，而结构化多块策略结果保持自身形状。有界完成通知先为稳定的 `background job <id>` 前缀与 `job_output` 收集指令预留空间，再把剩余字节用于可变的 kind、label、status、detail 与截断标记，因此在 PTY 支持的 64 字节下限下通知仍可操作；已有的生产方截断标记会被复用，不会重复添加。

### 通知投递通道

结算订阅（`{ owners: 'scope' }`）跳过注册表报告为 `awaited` 的结算、模型经 `job_kill` 杀停的任务、无所有者的任务与 teardown 结算，然后解析登记在拥有者会话下的 agent。`wakeup` 投递为空闲所有者开启一轮；设置了 `maxConsecutiveWakes` 时只在预算内开启，按确切 `Agent` 记录在 `WeakMap` 中，领取用户撰写的消息（`agent/inbox/claimed`）会重置该所有者的预算。繁忙的所有者——或超出所配预算的任何通知，以及 `quiet` 投递——改为注入 next-step inbox。注册表只计入结算时仍被欠着投影的等待，因此超时或中止的等待会让之后的结算照常通知；移除会把任务从模型杀停集合里删掉，该集合只保有模型杀停过的存活任务。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：工具注册、结算订阅与模型杀停集合、提示词区段、输出上限 |
| [`src/render.ts`](src/render.ts) | 面向模型的渲染：公共投影、状态行与消耗式增量（stdout、`[stderr]` 段、丢失输出提示） |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从任务类型逐步进入注册表约定与生成 schema。

- [后台任务运行时子系统](../../../docs/subsystems/jobs.zh.md)——任务类型、快照字段与 `ctx.jobs` 的 Cordis 接口面。
- [jobs 组映射](../README.zh.md)——同级组页面及其包表格。
- [注册表约定](../jobs/README.zh.md)——工具背后的抽象 `ctx.jobs` 服务。
- [进程本地注册表](../jobs-local/README.zh.md)——任务在本进程中的运行位置。
- [生成的工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-jobs)——`job_output`、`job_list` 与 `job_kill` 的确切 schema。
- [生成的配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-tool-jobs)——每个受支持配置字段及其源声明。
- [任务注册表 seam Agent Note](../../../.agents/notes/archived/architecture/2026-07-26-job-registry-seam.md)——按所有者隔离的注册表约定及其理由。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-tool-jobs'
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `waitTimeoutMs` | `30,000` | `wait: true` 省略 `timeout_ms` 时使用的等待时间 |
| `maxWaitTimeoutMs` | `600,000` | 模型所给等待时间的上限；更大的值向下收敛到它 |
| `completionDelivery` | `wakeup` | `wakeup` 为空闲所有者开启一轮；`quiet` 让通知继续待领 |
| `maxConsecutiveWakes` | 未设置 | 一个所有者可由唤醒开启的轮数，超出后通知降级为注入；未设置即不封顶 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-tool-jobs
