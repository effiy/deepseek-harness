---
title: "@deepseek-ai/dsh-subagent-fork-in-process"
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

`dsh-subagent-fork-in-process` 是一个进程内 subagent 后端：它以父级已完成的对话轮次作为每个子 agent 的初始内容——子 agent 能看到所有已完成轮次，但看不到进行中的轮次，因此后续工作可以在对话基础上继续，而无需重复提供对话内容。委派工具以 `fork` 提供方名称找到它，其行为与 spawn 后端一致，唯一差异是会话初始内容。当子任务延续当前对话时选择它；当子 agent 必须独立运行时选择 spawn。初始内容是 fork 时的一次性快照：此后父级记录的任何内容都不会到达子 agent。

---

## ⚡ 功能

### 适用场景

当子 agent 需要对话的已完成轮次时——后续分析、审查、延续——选择 fork。当子 agent 应全新开始时选择 spawn；当子 agent 不能共享本进程时选择进程外后端。初始内容只传递对话历史：子 agent 仍获得全新的工具作用域，且不继承父级的任何权限。

### 限制

这些限制说明何时选择该后端是错误的；它们是当前包约束。

- **初始内容是一次性快照**——子 agent 只能看到 fork 时父级已完成的轮次，看不到父级此后记录的任何内容；不会实时共享上下文。
- **前缀复用取决于请求输入是否匹配**——父级与子级的消息定义都逐字节相同；显式 persona、工具过滤、生成 SDK 或路由变化仍可破坏相等性。理由见[保持 fork 缓存的 Agent Note](../../../.agents/notes/implemented/architecture/2026-08-10-fork-children-stay-one-shot.zh.md)。
- **随附 fork 工具不公开子级 LLM（大语言模型）路由选择**——它们继承父级提供方与模型，使复制的历史仍有资格复用 KV Cache。在某项改动能保留复用或公开有界重算成本前，路由选择保持禁用。

---

## 📊 指标

### 子 agent 历史与包络

#### 模型看到什么

子 agent 先接收由父级已配平的已完成轮次构成的前缀，再逐字接收新的任务内容。配置的 persona 会在子 agent 的全新作用域中遮蔽提示词文本；工具限制会过滤其全局协议 schema、可执行工具查找与 PTC mode SDK 绑定，但不影响独立指导内容。父级的工具视图与权限不会被继承；可选的结构化输出请求会添加仅属于子 agent 的约定；父级当前进行中的轮次会被排除。

#### Token 影响

fork 会把保留的已完成历史复制到子 agent 的请求中，子 agent 随后独立累积自己的 token。persona 会改变重复提示词的成本；过滤会改变 schema 或生成 SDK 的成本；首轮 fork 没有继承历史。

#### KV Cache 影响

在提供方与模型相同的前提下，子 agent 可以复用继承的逐字节相同前缀。persona、工具过滤、生成 SDK 或路由变化可能在继承历史之前使复用失效；后续子 agent 历史仅追加。可继续消息不会增加子级专属的系统提示词区段或工具 schema；父级 ID 与返回指导在初始用户任务中位于继承历史之后（见[保持 fork 缓存的 Agent Note](../../../.agents/notes/implemented/architecture/2026-08-10-fork-children-stay-one-shot.zh.md)）。

### 父级工具结果（间接）

#### 模型看到什么

父级通过 `dsh-tool-subagent` 先收到子会话 ID，随后收到包含最终答案的完成通知。子级自行编写的消息通过 `send_message` 到达；继承的前缀与内部工作保留在子会话中。

#### Token 影响

父级输入增加一个取决于数据的最终结果，并保留到上下文压缩（context compaction）为止。

#### KV Cache 影响

仅追加；新增可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释后端背后的设计决策，以及[使用本包](#use-this-package)中行为的来源。

### 设计理念

本后端把父级日志中已配平的已完成轮次前缀作为子会话初始内容。subagent 服务记录继承范围，因此结果只包含子级自己的输出。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 提供方注册：前缀计算、`Config` schema、能力声明 |

### 运行流程

`prepareContinuable()` 在创建时捕获一次父级已完成轮次前缀。`startActivation()` 以此创建子 agent，并由 subagent 服务应用 persona、工具过滤与本次 activation 的结构化输出设置。提供方声明与 spawn 相同的 `agentOptions`、输出、深度、过滤及 persona 能力。

### 生命周期绑定

委派工具以后台 activation 创建子级，并返回稳定的子会话 ID。父级与子级共享相同的消息工具定义及顺序；父级 ID 与返回指导位于继承历史之后的初始任务中。工作流以调用方收集模式等待结果，不向父级发送完成通知。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 提供方注册：前缀计算、`Config` schema、能力声明 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面；它们从共享 subagent 模型进入兄弟后端，以及保留继承请求前缀的设计证据。

- [Subagent 子系统](../../../docs/subsystems/subagent.zh.md)——启动请求、结果、提供方约定与进程内深度和初始内容。
- [dsh-subagent-spawn-in-process](../subagent-spawn-in-process/README.zh.md)——全新子级的兄弟后端。
- [dsh-tool-subagent](../tool-subagent/README.zh.md)——指向该提供方的面向模型委派工具。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-subagent-fork-in-process)——每个受支持配置字段及其源声明。
- [Fork child 保留 parent 请求前缀](../../../.agents/notes/implemented/architecture/2026-08-10-fork-children-stay-one-shot.zh.md)——可继续 fork 为何保留继承的请求前缀。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-subagent'
- name: '@deepseek-ai/dsh-subagent-fork-in-process'
- name: '@deepseek-ai/dsh-tool-subagent'
  config:
    provider: fork
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `providerName` | `fork` | 注册到 `ctx.subagents` 的提供方名称 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-subagent-fork-in-process
