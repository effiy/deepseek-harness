---
title: "@deepseek-ai/dsh-workflow"
tags: []
category: "workflow"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

运行一段纯 JavaScript 编排脚本，将工作扇出给 subagent，并返回脚本的最终 JSON 值。脚本可以使用 `agent()`、`parallel()`、`pipeline()`、`phase()` 和 `log()`；模型通常通过 `workflow` 工具访问它们。每次运行都归调用方所有，将每个子 agent（智能体）归属于调用它的 agent，在失败或取消时以结果兑现而不拒绝，并在 dispose（资源释放）期间等待脚本与子 agent 清理完成。调用方必须提供执行引擎，因此可以更换隔离策略而不改变可见行为。

---

## ⚡ 功能

### 限制

这些限制说明该能力尚未支持什么。它们是当前约束，不是任务积压。

- **仅支持前台收集**——调用方拥有一个活动运行并等待它；后台启动／轮询、spill 句柄与分离收集均暂缓。
- **没有日志化或恢复**——脚本、子 agent 进度与中间值均不设检查点，因此进程重启后无法继续运行。
- **没有已保存或嵌套工作流**——该能力只启动调用方提供的脚本，工作流脚本不会收到用于递归编排的 `workflow()` 钩子。
- **没有 token 预算词汇**——引擎限制并发、条目与子 agent，但请求与结果都不会统计跨子 agent 的模型 token。
- **运行由持有方负责，不由服务跟踪**——卸载引擎不会发现独立的活动句柄；每个消费方都必须 dispose 自己启动的运行。

---

## 📊 指标

间接地，通过其消费方 `dsh-tool-workflow` 与一个工作流引擎，由它们渲染父级工具结果与子 agent 请求。

#### KV Cache 影响

不会直接导致失效；请求前缀的任何变化均由上述消费方与引擎负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释能力如何拆分、约定位于何处；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本包把脚本、运行、结果与事件约定同执行分开：任何引擎都可以在同一词汇背后实现 `ctx.workflowEngine`，一个上下文同时只有一个引擎——加载第二个引擎会明确报错，因此更换引擎意味着更改组合所加载的引擎插件。`workflow/*` 事件只供观察：payload 携带运行身份快照，绝不携带活动运行，因此监听器无法取得取消或 dispose 权限。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务定义、`workflow/*` 事件声明、`WorkflowError` 及其 fatal 标志 |
| [`src/types.ts`](src/types.ts) | 浏览器安全词汇：`WorkflowMeta`、`WorkflowResult`、运行与 agent 事件信息 |
| [`src/runtime-types.ts`](src/runtime-types.ts) | 仅宿主的 `WorkflowStartRequest` 与 `WorkflowRun` 句柄 |

### 生命周期与归属

运行由持有方负责：引擎插件卸载会阻止新的启动，但不会撤销已接受的运行，调用方必须 dispose 自己启动的每个运行。`dispose()` 在需要时取消，并等待脚本与子 agent 清理完成。PTC 引擎立即中止受管进程；子 agent 的资源释放仍遵循各 subagent 提供方的生命周期约定。

`workflow/start` 与 `workflow/end` 为运行配对；`workflow/phase` 与 `workflow/log` 携带脚本叙述；`workflow/agent-start` 与 `workflow/agent-end` 按 `seq` 为每次子 agent 调用配对。每个监听器都独立隔离：抛错的监听器只记录日志，不会饿死同级监听器或改变执行，并且每个监听器都会收到自己的 payload 副本。

### 失败纪律

`WorkflowError` 携带机器可路由的 code 与 `fatal` 标志；每个 code 都是致命的，`parallel()` 与 `pipeline()` 会重新抛出致命错误，而不是把条目映射为 `null`——拼错的选项必须明确终止脚本。code 覆盖启动失败、约定违规、超出上限、提供方与结果故障、不可序列化值与取消；完整集合与含义见 [`src/index.ts`](src/index.ts)。

逐项 `null` 只保留给子运行失败与阶段内普通脚本错误，因此以非完成结束原因正常结算的子 agent 不属于基础设施异常：`agent()` 返回 `null`，让脚本处理普通子 agent 失败。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：尚未决定的开放方向。它明确不具权威性——已交付的行为、限制与既定理由以上文、包代码与相关 Agent Note 为准。

暂缓的方向：带 spill 句柄与分离收集的后台启动／轮询 API；已保存与嵌套工作流；以及跨子 agent 的 token 预算词汇。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务定义、`workflow/*` 事件声明、`WorkflowError` 及其 fatal 标志 |
| [`src/types.ts`](src/types.ts) | 浏览器安全词汇：`WorkflowMeta`、`WorkflowResult`、运行与 agent 事件信息 |
| [`src/runtime-types.ts`](src/runtime-types.ts) | 仅宿主的 `WorkflowStartRequest` 与 `WorkflowRun` 句柄 |

---

## 🔗 资源

当包级契约不够用时阅读以下页面。它们从共享工作流模型逐步进入当前引擎与面向模型的消费方。

- [工作流子系统](../../../docs/subsystems/workflow.zh.md)——完整类型词汇、启动请求与事件载荷。
- [组地图](../README.zh.md)——工作流能力家族及其包。
- [workflow 工具](../tool-workflow/README.zh.md)——拥有调用 schema 与结果包络的模型侧消费方。
- [PTC 工作流引擎](../workflow-ptc/README.zh.md)——当前执行引擎及其隔离边界。
- [历史动态工作流 Agent Note](../../../.agents/notes/archived/feature/2026-07-05-dynamic-workflows.md)——seam 设计及其决策。

---

## 🚀 快速开始

当任务分解为许多独立部分、适合用一段脚本统一协调——例如跨多个文件的审计、一次迁移、多角度研究——且模型明确要求工作流式编排时，运行工作流。一两项委派时，优先使用普通 subagent 调用。

### 模型侧路径

模型通过 `dsh-tool-workflow` 的 `workflow` 工具触达该能力；该工具拥有调用 schema 与结果包络，引擎提供其下的执行。一次工具调用提交 `meta`、`script` 与可选 `args`，运行完成时返回 `{ runId, agentsStarted, result }`。工具会阻塞父级轮次直到整个工作流结算，因此模型只看到最终结果，永远不会

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-workflow
