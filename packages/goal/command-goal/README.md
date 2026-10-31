---
title: "@deepseek-ai/dsh-command-goal"
tags: []
category: "goal"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-command-goal` 为用户提供 `/goal` 命令，以便直接在交互式 UI 中创建、编辑、暂停、恢复、清除并查看当前 goal。命令及其直接输出留在 UI 中，不进入模型请求。接受的变更会持久化；create 或 edit 携带的有序图片或文件附件会成为一条普通用户消息，供后续 Goal Round 读取。此包适用于带命令适配器的交互式部署；没有适配器的无头与自动化应用不需要它。

---

## ⚡ 功能

### 限制

这些限制说明命令何时不合适或需要特别注意。它们是当前包约束，不是任务积压。

- **仅纯文本交互**——通用命令注册表没有模态编辑表单或替换确认回调；内联 edit 与显式 clear 能在不同适配器中保持明确且一致的破坏性意图。
- **没有逐命令 Round 上限参数**——`defaultMaxGoalRounds` 仍是部署配置；用户直接请求时，可以要求模型通过另行授权的 goal 工具编辑 `max_goal_rounds`。
- **没有持续状态组件**——裸 `/goal` 是可移植的观察接口；不提供适配器专用徽标或重连后可恢复的命令输出。
- **随附应用中只有 Web 命令适配器使用此命令**——无头、ACP 自动化和 JSON-RPC 适配器不消费 `ctx.commands`。如果组合中包含面向模型的 goal 工具，普通提示词仍能授权它们。

---

## 📊 指标

### 用户 `/goal` 控制

#### 模型看到的内容

斜杠输入、变更以及直接状态或错误输出不会进入模型请求。goal 领域把变更记录为 `goal/change`；已启用的同会话驱动器可以在后续续行提示词中暴露结果状态。呈现文本不会记录到日志中。当 create 或 edit 携带附件时，模型会看到一条普通用户消息：有序的图片块与文件块后跟文本 `Reference attachments for the goal objective.`。它在会话历史中位于下一个 Goal Round 之前。

#### Token 影响

读取状态、变更 goal 或收到直接命令错误不会增加模型 token。已启用的同会话驱动器可能增加后续 Goal Round 提示词。目标携带的附件会增加一条普通用户消息，产生常规文本、图片和文件句柄成本。

#### KV Cache 影响

命令发现、变更与直接输出不会影响缓存。后续续行提示词遵循驱动器的普通请求历史。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释命令如何解析输入并渲染输出；可观察约定已在[使用本包](#use-this-package)中说明。

### 设计

- **语法，而非自由文本。** 解析器只在控制词（`clear`、`pause`、`resume`、`edit`）填满整个输入时识别它们；其他任何非空后缀都是目标。单独的 `edit` 无效，且 `edit` 拒绝直接替换未完成的 goal。
- **领域拒绝变成稳定错误。** `GoalError` 结果会转换为带固定消息的直接命令错误；意外失败会重新抛出，使适配器报告命令失败而非领域结果。渲染输出绝不暴露带品牌类型的 id 或 revision。
- **附件随目标提交。** create 或 edit 成功时，命令提交一条用户 followup 消息，按选择顺序携带已准入的图片块与文件块，再附加固定文本 `Reference attachments for the goal objective.`。其他路径不提交消息，因此分发方 composer 保留草稿和附件卡。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：命令语法、状态渲染、附件提交 |

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文，明确不具权威性。开放且未决：持续状态组件与逐命令 Round 上限输入；两者都是延后的 UI 与配置工作。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：命令语法、状态渲染、附件提交 |

---

## 🔗 资源

该命令是 goal 领域的薄适配器；需要了解它变更的状态与它接入的注册表时阅读以下页面。

- [goal 服务](../goal/README.zh.md)——命令变更的状态与生命周期。
- [命令服务](../../interaction/commands/README.zh.md)——命令注册表约定与分发。
- [历史Harness 层目标式执行 Agent Note](../../../.agents/notes/archived/feature/2026-07-16-harness-level-loop.md)——用户体验与组合决策。

---

## 🚀 快速开始

### 配置

```yaml
- id: commands
  name: '@deepseek-ai/dsh-commands'
- id: goal
  name: '@deepseek-ai/dsh-goal'
- id: command-goal
  name: '@deepseek-ai/dsh-command-goal'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：命令语法、状态渲染、附件提交 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-command-goal
