---
title: "@deepseek-ai/dsh-subagent-dsh-sdk"
tags: []
category: "subagent"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-subagent-dsh-sdk` 在全新的 DeepSeek Harness 子进程中运行每个委派任务，子进程拥有自己的 profile、会话、模型路由与工具。父级提供任务与工作目录，每个子进程使用其已配置的运行时，并与父级对话保持隔离。父级只会收到子进程最终的 assistant 文本或安全错误；中间消息与工具流量保留在子进程内。当委派需要完整的 Harness 运行时而不是共享进程内状态时，选择此后端，并接受每次运行都要启动新进程的成本。

---

## ⚡ 功能

### 适用场景

当子进程必须是完整的 harness 对等体——拥有自己的组合、会话持久化、模型路由与工具——而不是共享父进程的 agent 时，选择此后端。当子进程必须共享父级组合或遵守父级强制的非路由能力时，请选择进程内后端：本提供方接受 agent 路由选项，但会拒绝结构化输出、深度上限、工具过滤或 persona，而不是静默省略。

提供方声明 `agentOptions: true`，同时保持 `outputSchema`/`depthLimit`/`toolFilter`/`persona` 为 false，并且 `inheritsParentContext: false`。不可变的 `agentRouteDefaults` 会在模型覆盖与确切路由预检前，把配置的 provider／model 基线公开给 `dsh-tool-subagent`；后端在 activation 启动时应用同一份配置默认值，包括 `maxTokens`。agent 路由值通过显式白名单跨越 SDK 协议；子进程仍是另一进程里的全新运行时，子进程使用所选有效目录，而其 Session 保留父级起始目录。基于本提供方的 `dsh-tool-subagent` 部署应设置 `maxDepth: 'provider-managed'`——子 harness 拥有自己的递归预算。

### 限制

这些限制说明本后端何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是通用 SDK 对比或任务积压。

- **每次运行都使用全新的运行时进程**——不使用进程池；harness 运行时需要启动完整的插件树，因此每次运行的 spawn 成本高于 ACP 后端通常使用的子进程。
- **不支持路由之外的启动时能力**——父级可以选择子 agent 路由，但无法在子进程内强制执行 `outputSchema`、深度限制、工具过滤或 persona；应改为配置所选子 profile 及其有序 patch。
- **子任务转录保留在子进程自己的会话根目录中**——父日志保留外部任务身份与完整结果；流式 `session.event` 通道用于提取输出，不用于复制子任务转录。
- **仅支持本地子进程**——解析出的工作目录是本地路径；远程运行时需要独立的后端。

---

## 📊 指标

### 子 agent 请求

#### 模型看到什么

子运行时的模型会收到作为用户消息的独立任务，以及该运行时自身配置的系统提示词、工具和全新会话。它不会收到父级对话。父级工具调用可以为本次运行选择子级提供方、模型与推理强度；所选路由和由部署控制的可选输出上限会固定到这个新子进程。persona、工具过滤、深度强制与结构化输出仍不受支持，并会被拒绝而不是静默省略。

#### Token 影响

子运行时会为独立的完整上下文及其多步骤历史消耗 token。这些 token 绝不会进入父级上下文。

#### KV Cache 影响

与父级请求缓存相互独立。每个 SDK 子进程只能复用其自身提供方、模型、组合和历史均相同时的前缀；除此之外，子 agent 的步骤仅追加增长。

### 父级工具结果（间接）

#### 模型看到什么

通过 `dsh-tool-subagent`，父模型先收到 child id，随后收到含最终或部分 assistant 文本、停止原因与安全诊断的完成通知。父会话独立保存外部任务身份和完整终态结果。中间消息与工具通信不进入父会话。

#### Token 影响

父级输入增加启动确认与完成通知，内容大小取决于数据，并保留到压缩（compaction）为止。本提供方自身不会向父级添加任何 schema。

#### KV Cache 影响

仅追加；新增可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释后端如何驱动子 Harness 运行时，以及可观察行为从何而来；完整约定见[使用本包](#use-this-package)。

### 设计理念

- **完整 harness 对等体。** 每个子进程都是独立进程中的完整 Harness 运行时——拥有自己的组合、会话、模型路由与工具；只有解析后的工作目录与 `initialize` 路由从父级跨越。
- **每次运行一个运行时。** 每次运行都 spawn 全新运行时进程；没有进程池。
- **JSON-RPC 协议格式（wire format）是序列化边界。** 同进程 subagent 值不会为防御目的克隆；协议才是校验不可信输入的地方。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：config schema、提供方注册 |
| [`src/run.ts`](src/run.ts) | SDK 运行生命周期、答案提取与停止原因映射 |

### 运行流程

一次启动会在 spawn 前解析子进程工作目录与一条进程级 SDK 路由。`request.agentOptions` 中每个已声明字段（`provider`、`model`、`reasoningEffort` 或 `maxTokens`）都会覆盖对应的提供方实例默认值；省略时保留已配置的提供方／模型与可选上限，而推理强度只有在请求提供时才会出现。随后，提供方通过 SDK 客户端 spawn 运行时，并在履行前完成 `initialize` 握手，其中包括确切模型与推理强度校验。路由、spawn、握手或发布前取消失败时，只会在子进程被回收后拒绝；工作目录解析失败则会在尚未 spawn 任何内容时拒绝。发布后，提供方先订阅子会话，再排入提示词，并通过 `session/wait` 等待受管理后代与根 Agent 后续轮次。它从有序会话事件中读取答案：最后一条完整且非空的 `assistant/message`（记录 usage 的空内容消息会被跳过）；若没有这类消息，则取累积的 `text-delta` 流。dispose 是幂等的：先在本地把结果确定为 `aborted`，发出有界的协议 `shutdown` 请求，再经 stdin EOF → SIGTERM → SIGKILL 升级到实际退出。任务接受后由 activation 管理器拥有该运行；此后调用方的启动信号不再取消子任务。每个 activation 只执行一次，其凭据用于取消执行并等待清理。

### 停止原因映射

子进程最后一个 `turn/end` 的原因会映射进共享的停止原因词汇，实现见 [`src/run.ts`](src/run.ts)。

### 进程边界

子进程环境以子进程 seam 中已清除凭据的父环境为基础，并在清除之后合并显式 `config.env` 值。子进程由 SDK 客户端 spawn，而不是经由 `ctx.subprocess`——这是 SDK 托管传输的文档化例外——因此本后端会自行执行环境清理。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放问题与尚未决定的探索方向。它明确不具权威性——已交付的行为与限制以上文和包代码为准。

- **Spawn 成本**——每次运行加载完整插件树是彻底隔离的代价；池化会改变这一权衡。
- **远程运行时**——远程运行时需要独立的后端与工作区映射。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：config schema、提供方注册 |
| [`src/run.ts`](src/run.ts) | SDK 运行生命周期、答案提取与停止原因映射 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从本后端逐步进入它接入的 seam 与它驱动的 SDK。

- [Subagent 子系统](../../../docs/subsystems/subagent.zh.md)——服务约定、提供方约定与终态结果语义。
- [dsh-subagent seam](../subagent/README.zh.md)——本提供方注册于其上的注册表与启动 API。
- [ACP subagent 后端](../subagent-acp/README.zh.md)——经 Agent Client Protocol 的兄弟进程外提供方。
- [TypeScript SDK 客户端](../../sdk/client/README.zh.md)——本后端用以驱动子进程的 stdio JSON-RPC 客户端。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-subagent-dsh-sdk)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- id: subagent-dsh-sdk
  name: '@deepseek-ai/dsh-subagent-dsh-sdk'
  config:
    providerName: dsh-sdk
    profile: sdk
    patches: ['./profiles/research-child.cordis.yml']
    dshHome: !!js dshHomePath('children')
    maxTokens: 49152
    env:
      DEEPSEEK_API_KEY: !!js process.env.DEEPSEEK_API_KEY
- id: tool-subagent
  name: '@deepseek-ai/dsh-tool-subagent'
  config: { provider: dsh-sdk, toolName: subagent, maxDepth: 'provider-managed' }
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：config schema、提供方注册 |
| [`src/run.ts`](src/run.ts) | SDK 运行生命周期、答案提取与停止原因映射 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-subagent-dsh-sdk
