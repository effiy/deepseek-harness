---
title: "@deepseek-ai/dsh-goal"
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

`dsh-goal` 让一个长期完成目标在多轮、会话恢复、fork 与进程重启后持续存在。用户与 agent（智能体）可以 create、edit、pause、resume、complete、block 或 clear 该目标；比较并设置的更新会拒绝陈旧视图。可配置的 Round 上限（默认 256）约束自动续行，被阻塞的 goal 会保留稳定的策略代码和面向人的说明。本包存储 goal 状态但不调度工作，续行权限是进程本地的而非持久状态。单个目标需要横跨多轮时选择本包；常规单轮工作或并行目标不要使用。

---

## ⚡ 功能

### 限制

这些限制说明 goal 服务何时不合适或需要特别注意。它们是当前包约束，不是任务积压。

- **只负责状态，不负责任务调度**——本包不决定已启用续行的 goal 何时继续，不重试异常失败，也不取消活跃轮次；这些策略属于 `dsh-goal-round-driver` 等消费方包。
- **只有 Round 数量预算**——`maxGoalRounds` 不计量 token、货币、挂钟时间或提供方配额。
- **没有独立评估器**——记录完成或阻塞的调用方拥有最终决定权；由评估器支持的认证暂缓到独立策略层。
- **只有一个当前 goal**——系统有意不支持并行目标或独立 goal 数据库；替换或清除后，历史仍可在会话日志中读取。
- **信任进程内生产方**——能直接访问 `Session` 的插件可以追加伪造的 `goal/change` 数据。严格回放会检测格式错误或不一致的记录，并使 goal 访问从该记录起失败，直到日志修复；这是完整性检测，不是插件隔离。

---

## 📊 指标

### 目标状态变更

#### 模型看到什么

Goal 变更不会注入模型上下文。`get_goal` 等工具返回当前状态；续行消费方可以在调度模型工作时渲染目标与 Round 状态。

#### Token 影响

Goal 变更事件本身不增加模型 token。工具结果与续行调度提示词各自暴露的状态会分别计入 token 用量。

#### KV Cache 影响

在其他组件把 goal 状态暴露为模型可见输入之前，不会影响 KV Cache。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释服务如何实现上述行为；可观察约定已在[使用本包](#use-this-package)中说明。

### 设计

- **事件溯源状态。** 每次变更都追加持久的 `goal/change` 事件（版本 1），携带变更后的完整快照；clear 写入带 revision 的 tombstone。会话日志是唯一的持久权威。
- **比较并设置的变更。** `ctx.goals` 只接受以对应 id 注册的完全相同的活跃 `Agent` 实例。`get()` 返回脱离状态的 `GoalView`；变更携带 `GoalRef { id, revision }` 并拒绝陈旧引用。创建在提交前于内部解析部署默认值。
- **续行启用状态是进程本地的。** `armed` 与 `disarmed` 保存在每会话缓存中，绝不持久化。新缓存与每次 `agent/created` 边界都会停用续行，即使回放发现持久 phase 为 active；`disarm()` 移除续行权限，不写入 revision 也不发出变更事件。
- **严格回放。** 折叠只从 `goal/change` 派生生命周期变更，并拒绝形状错误、不连续 revision、非法 phase 转换、每目标时间戳非单调，以及不连续的已准入 Round。只有已准入的来源为 goal 的 `user/message` 事件会推进正数 Round；挂钟时间倒退时，变更时间戳会限制在不早于上一次更新的值。
- **投影单元。** 本包要求提供投影注册表，并注册一个严格的 `goal` 单元。其宿主状态保留回放校验数据与第一次失败，客户端视图提供最新有效的完整 goal 或 `null`；保留回放失败后，`GoalService` 会拒绝访问。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`GoalService`、配置 schema、变更、续行启用缓存、投影单元 |
| [`src/domain.ts`](src/domain.ts) | 持久变更载荷、`goal/changed` 事件、goal 消息来源归属 |
| [`src/types.ts`](src/types.ts) | 纯客户端安全类型：`GoalView`、`GoalSnapshot`、`GoalActivationChanged`、投影键声明 |
| [`src/fold.ts`](src/fold.ts) | 持久 goal 变更的严格回放折叠与解码器 |
| [`src/runtime.ts`](src/runtime.ts) | `GoalId` 品牌、`GoalError` 代码、变更版本常量 |

### 事件与归属

`goal/changed` 在持久事件提交后触发，监听器失败会被隔离；载荷携带操作、精确 ref 与最新视图（clear tombstone 时省略）。`goal/activation-changed` 在不改变持久状态的情况下，转发携带精确当前 ref 的进程本地 `armed`／`disarmed` 边界；clear 后则不携带 goal。已准入的续行 Round 通过 `user/message` 事件上的 `GoalMessageSource { goalId, revision, round }` 归属，严格折叠会将其验证为当前 goal 的下一个已准入 Round。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文，明确不具权威性。开放且未决的方向：为需要在每个模型请求中看到目标的部署提供始终可见的 goal 上下文插件，以及由评估器支持的完成与阻塞认证。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`GoalService`、配置 schema、变更、续行启用缓存、投影单元 |
| [`src/domain.ts`](src/domain.ts) | 持久变更载荷、`goal/changed` 事件、goal 消息来源归属 |
| [`src/types.ts`](src/types.ts) | 纯客户端安全类型：`GoalView`、`GoalSnapshot`、`GoalActivationChanged`、投影键声明 |
| [`src/fold.ts`](src/fold.ts) | 持久 goal 变更的严格回放折叠与解码器 |
| [`src/runtime.ts`](src/runtime.ts) | `GoalId` 品牌、`GoalError` 代码、变更版本常量 |

---

## 🔗 资源

包级约定对大多数消费方已经足够；需要了解周边领域与设计理由时阅读以下页面。

- [goal 子系统](../../../docs/subsystems/goal.zh.md)——goal 类型、持久的变更载荷与生成的服务 API。
- [goal 组地图](../README.zh.md)——goal 各包及其组合方式。
- [生成的配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-goal)——每个受支持配置字段及其源声明。
- [历史goal 领域 Agent Note](../../../.agents/notes/archived/feature/2026-07-19-persisted-same-session-goal-domain.md)——领域设计、备选方案与决策。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-goal'
  config:
    defaultMaxGoalRounds: 256
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `defaultMaxGoalRounds` | `256` | 当 create 请求省略上限时应用的 Round 上限 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-goal
