---
title: "@deepseek-ai/dsh-subagent-claude-code"
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

当委派任务应在父工作区中以全新、无人值守的 Claude Code 会话运行时，安装这个 Profile Bundle。每次运行接受一个自包含文本任务，并返回最终答案或安全的失败诊断；推理、工具通信、stderr、用量信息和工作区差异不会进入父 Session。Claude 原生设置与身份验证继续是权威来源，而 Profile 配置选择模型、环境和 `permissionMode`。针对平台锁定的运行时仅在需要时启动，并且绝不会回退到宿主 `claude` 可执行文件。当隔离和真实 Claude Code 行为比续接或提示更重要时，选择本包。

---

## ⚡ 功能

### 限制

这些限制说明本提供方何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是通用 Claude Code 对比或任务积压。

- **每次运行均新建一个 query 和一个进程**——不支持续接、恢复、池化、进度流或产品会话持久化。
- **静态选择实例**——Profile 配置项固定提供方名称、可选模型与工具绑定；调用无法动态选择或修改提供方与模型，而且每个公开工具都需要唯一的 `toolName`。
- **宿主设置有意保持权威**——省略 `model` 时由项目与用户设置选择模型；原生设置始终保留其余工具和行为，本提供方不提供经过筛选或与宿主环境隔离的生产模式。
- **身份验证与账户状态仍由原生机制管理**——Bundle 会提供 CLI，但不会创建账户、登录或改写 Claude 设置；配置与身份验证失败会公开其生命周期阶段与安全的 `unknown` 回退，而不会增加单独的公开分类。
- **委派时必须存在 SDK 平台载荷**——省略 optional dependencies 的安装、不受支持的平台以及缺失或损坏的载荷都会在第一次 query 时失败；不会回退到宿主 CLI。
- **没有人工交互路径**——`AskUserQuestion` 被禁用，权限提示会被拒绝，MCP elicitation 会被拒绝，阻塞对话会以拒绝方式失败而不会挂起。
- **assistant 载荷仅包含最终文本**——失败运行还可公开独立的安全诊断；推理、中间消息、工具通信、用量、stderr 与工作区差异不会进入父 Session。任务身份与终态结果保存在父日志中。
- **没有可选的共享能力**——对于本提供方，共享服务会拒绝 `agentOptions`、输出 schema、子任务角色设定、工具筛选和 harness 深度强制约束。
- **没有按实际经过时间触发的超时或副作用回滚**——长时间运行的工作由调用方取消，且取消前已更改的文件或外部系统不会恢复原状。

---

## 📊 指标

### 子级请求

#### 模型看到什么

Claude Code 子级会在一个全新的 SDK query 中接收独立文本任务。它的工作区是所选子级工作目录；所选提供方实例会固定已配置的模型、环境与非交互权限模式，而省略的模型及其余产品设置来自 Claude 原生配置。可执行版本来自 Bundle 锁定的 SDK 平台载荷。

#### Token 影响

子级需为独立的 Claude Code 上下文和 query 承担 token 成本。子级 token 不会进入父级上下文。

#### KV Cache 影响

与父级请求缓存相互独立。能否复用只取决于 Claude Code 自身的模型、指令、工具、原生设置和全新 query。

### 父级调度与结果（间接）

#### 模型看到什么

通过 `dsh-tool-subagent`，父模型先收到 child id，随后收到 Claude Code 最终答案或带停止原因与安全诊断的失败通知。诊断只包含固定的阶段、类别和已观测的协议或进程事实。产品推理、中间消息、工具活动、stderr、用量、产品标识符、命令、路径与原始协议载荷不会复制到父 Session。

#### Token 影响

父级输入会增加启动确认与完成通知，包括最终答案或失败信息。子任务 token 不进入父级上下文。本提供方自身不添加父级工具 schema。

#### KV Cache 影响

启动确认与完成通知仅追加到可复用的父请求前缀之后。通知可能唤醒新轮次，不会改写已有前缀。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释提供方如何驱动真实 Claude Code CLI，以及可观察行为从何而来；完整约定见[使用本包](#use-this-package)。

### 设计理念

- **每次运行一个全新 query。** 每次运行都拥有独立的 SDK query、取消控制器、CLI 进程与不持久化的产品会话；没有续接、恢复或池化。
- **原生设置是权威。** 提供方故意省略 SDK 的 `settingSources` 选项，因此 Claude Code 读取宿主机常规的用户、项目与本地设置；可选 `model` 与必需的 `permissionMode` 是仅有的 query 级覆盖。
- **刻意无人值守。** `AskUserQuestion` 被禁用，除 bypass 模式外权限提示都会被拒绝，因此 query 绝不会等待用户界面。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：配置 schema、提供方注册 |
| [`src/run.ts`](src/run.ts) | SDK query 生命周期、结果接受与权限处理 |
| [`src/process.ts`](src/process.ts) | dispose（资源释放）时的 managed-range 逐级终止 |
| [`cordis.patch.yml`](cordis.patch.yml) | 注册提供方并添加预设委派工具的 Profile 配置层 |

### 运行流程

一次启动只接受非空的文本块序列，并使用子代理服务选择的子级 cwd。它创建私有 `AbortController`，用精确拼接的任务调用官方 SDK `query()`，并仅在 SDK 的 custom-spawn 钩子已经提供由子进程 seam 管理的活动 CLI 句柄后发布运行。提供方完整迭代消息流，只接受满足 `subtype: "success"`、`is_error: false` 且 `result` 非空白、随后迭代器正常结束的 `result` 消息。其余一切结果都映射为带固定类别的 `error` 诊断，命名生命周期阶段与已观测进程结果——类别集合见 [`src/run.ts`](src/run.ts)。本地取消会在结果竞态中胜出并映射为 `aborted`，且不附带失败诊断。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：配置 schema、提供方注册 |
| [`src/run.ts`](src/run.ts) | SDK query 生命周期、结果接受与权限处理 |
| [`src/process.ts`](src/process.ts) | dispose（资源释放）时的 managed-range 逐级终止 |
| [`cordis.patch.yml`](cordis.patch.yml) | 注册提供方并添加预设委派工具的 Profile 配置层 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从本提供方逐步进入它接入的 seam 与兄弟产品提供方。

- [Subagent 子系统](../../../docs/subsystems/subagent.zh.md)——服务约定、提供方约定与终态结果语义。
- [dsh-subagent seam](../subagent/README.zh.md)——本提供方注册于其上的注册表与启动 API。
- [Codex subagent 提供方](../subagent-codex/README.zh.md)——经官方 app-server 协议的兄弟产品后端。
- [历史Claude Code 与 Codex 后端](../../../.agents/notes/archived/feature/2026-08-04-claude-code-and-codex-subagent-backends.md)——产品提供方的设计记录。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-subagent-claude-code)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- insert:
    - id: subagent-claude-code
      name: '@deepseek-ai/dsh-subagent-claude-code'
    - id: tool-subagent-claude-code
      name: '@deepseek-ai/dsh-tool-subagent'
      config:
        provider: claude-code
        toolName: subagent_claude_code
        maxDepth: provider-managed
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：配置 schema、提供方注册 |
| [`src/run.ts`](src/run.ts) | SDK query 生命周期、结果接受与权限处理 |
| [`src/process.ts`](src/process.ts) | dispose（资源释放）时的 managed-range 逐级终止 |
| [`cordis.patch.yml`](cordis.patch.yml) | 注册提供方并添加预设委派工具的 Profile 配置层 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-subagent-claude-code
