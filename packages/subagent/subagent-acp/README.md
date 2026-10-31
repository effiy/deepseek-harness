---
title: "@deepseek-ai/dsh-subagent-acp"
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

使用本包可将任务委派给运行在全新子进程中的 ACP 兼容 agent；子 agent 拥有独立的运行时、会话、模型和工具。每次运行只共享选定的工作目录，通过 ACP 发送任务，并返回子 agent 的最终答案或安全错误；中间消息和工具流量不会进入父级对话。权限提示由配置的策略自动应答，无需人工介入。当委派需要进程隔离或需要使用非 Harness ACP agent 时选择本包；当子 agent 必须共享父级能力时，选择进程内后端。

---

## ⚡ 功能

### 适用场景

当子 agent 必须在独立进程中运行、拥有自己的运行时、模型和工具时选择此后端——例如来自其他项目的 ACP agent——或者你希望委派完全无法触及父 harness 时。当子 agent 必须共享父级组合或遵守父级强制执行的能力约束时，请选择进程内后端：本提供方不声明任何可选启动时能力，因此 seam 会拒绝要求 `agentOptions`、结构化输出、深度上限、工具过滤或 persona 的请求，而不是静默省略。

### 限制

这些限制说明本后端何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是通用 ACP 对比或任务积压。

- **每次运行使用全新进程**——没有进程池；每次委派都要付出完整的 spawn 与 ACP 握手成本。
- **仅支持本地工作区**——解析后的工作目录是交给同一台机器上子进程的本地路径；远程工作区映射尚未设计。
- **不支持可选启动时能力**——本提供方无法在远程进程内应用 `agentOptions`、`outputSchema`、深度上限、工具过滤器或 persona，因此 seam 会拒绝需要它们的请求。
- **只收集已提交的 `agent_message_chunk` 文本**——自动化服务器把推理（reasoning）、工具活动、计划和其他 trace 数据保留在子 agent 会话日志中，不通过 ACP 发出。
- **权限提示自动应答**（`permission: allow | reject`）——不会把子 agent 的 `session/request_permission` 呈现给人。

---

## 📊 指标

### 子 agent 请求

#### 模型看到什么

远程子 agent 通过 ACP 接收独立任务内容，并使用其自身进程配置的系统提示词、工具和全新会话。它不接收父级对话。本提供方不声明可选启动时能力，因此本地服务会拒绝要求 `agentOptions`、persona、工具过滤、深度强制或结构化输出的请求，而不是静默省略。

#### Token 影响

子 agent 为独立的完整上下文及其多步骤历史支付 token 成本。这些 token 绝不会进入父级上下文。

#### KV Cache 影响

与父级请求缓存相互独立。每个 ACP 子 agent 只能在其自身提供方、模型、组合和历史均相同时复用前缀；其余情况下，子 agent 步骤仅追加增长。

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

本节解释后端如何经 ACP 驱动子 agent，以及可观察行为从何而来；完整约定见[使用本包](#use-this-package)。

### 设计理念

- **完全进程隔离。** 每个子 agent 在全新子进程中运行，拥有自己的会话、模型与工具；只有解析后的工作目录来自父级。
- **每次运行一个进程。** 每次运行都 spawn 新进程；没有进程池。
- **ACP 协议格式（wire format）是序列化边界。** 同进程 subagent 值不会为防御目的克隆；协议才是校验不可信输入的地方。

### 启动与所有权流程

一次启动使用管理器解析的子 agent 工作目录（请求覆盖值，否则取父级当前有效目录），经子进程 seam spawn 命令，完成 ACP `initialize` 与 `newSession` 握手，然后才发布运行。兑现后，外部运行由 activation 管理器接管。任务接受后会解除启动信号的绑定；activation 凭据用于取消执行并等待清理。每个 activation 只运行一个任务，不能接收追加输入。dispose（资源释放）是幂等的：先关闭 stdin 并按配置的宽限等待协作式完全停稳，再经 SIGTERM 升级到 SIGKILL，并等待整个 managed range 退出。清理失败会作为有序的安全事实保持可观察，且绝不声称已经完全停稳。

### 停止原因映射

运行结果会把 ACP 终态映射进共享的停止原因词汇（`completed`、`max-tokens`、`refusal`、`aborted` 或 `error`），实现见 [`src/run.ts`](src/run.ts)。

### 进程边界

子进程经子进程 seam spawn：先清除疑似凭据的环境变量，再合并显式 `config.env` 值。stderr 继承到父级流，dispose 先应用本提供方的 EOF 窗口，再执行共享的逐级终止。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放问题与尚未决定的探索方向。它明确不具权威性——已交付的行为与限制以上文和包代码为准。

- **进程池**——持久进程复用是可能的未来优化，但会改变每次运行的隔离模型。
- **远程工作区**——映射远程 ACP agent 的工作区需要独立的后端能力。
- **可继续执行的 ACP 子 agent**——需要持久化远程会话 id，并为每个子 agent 声明继续执行能力。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从本后端逐步进入它接入的 seam 与它驱动的协议。

- [Subagent 子系统](../../../docs/subsystems/subagent.zh.md)——服务约定、提供方约定与终态结果语义。
- [dsh-subagent seam](../subagent/README.zh.md)——本提供方注册于其上的注册表与启动 API。
- [Agent Client Protocol 自动化服务器](../../acp/acp/README.zh.md)——本提供方作为客户端驱动的仅自动化服务器。
- [dsh-subprocess seam](../../subprocess/subprocess/README.zh.md)——每次运行背后的进程 spawn 与清理机制。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-subagent-acp)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- id: subagent-acp
  name: '@deepseek-ai/dsh-subagent-acp'
  config:
    providerName: acp
    command: dsh
    args: ['--profile', 'acp', '--patch', '/absolute/path/to/acp.patch.yml']
    permission: reject
    env:
      DSH_HOME: /absolute/path/to/isolated-child-home
      DEEPSEEK_API_KEY: !!js process.env.DEEPSEEK_API_KEY
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-subagent-acp
