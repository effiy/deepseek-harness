---
title: "@deepseek-ai/dsh-shell"
tags: []
category: "shell"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用 `ctx.shell` 运行输出有界的 shell 命令，或让命令作为后台工作继续运行。同一个执行句柄支持前台结果与后台读取。配置文件可以选择本地或沙箱化的 Bash 或 PowerShell 执行方式，而无需更改调用方。执行前解析请求，以显式确定工作目录、超时与输出上限。命令退出、超时和调用方中止都会作为结果返回；只有基础设施故障才会 reject，模型可见的渲染与沙箱指引由 `bash` 和 `pwsh` 工具负责。

---

## ⚡ 功能

### 限制

这些限制说明该 seam 不提供什么。它们是当前包约束，不是路线图。

- **没有交互式输入词汇**——`stdin` 只在 spawn 时写入一次并关闭；seam 没有向运行中任务继续输入的通道，也没有 PTY 会话概念。
- **前台超时始终由执行器负责**——seam 上由调用方负责 deadline 的模式已由[工具调用超时策略笔记](../../../.agents/notes/implemented/architecture/2026-07-07-tool-call-timeout-policy.zh.md)明确延期。

---

## 📊 指标

通过 `dsh-tool-bash` 间接影响；该工具会将执行器输出与沙箱事实转为指引和保留的工具结果 token。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀的任何变更由具名消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释 seam 的设计并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本包是标准能力 seam 中的一个角色：命名执行器约定的 Service Definition，Service Provider 与 Consumer 各自拆分，使每个角色都能独立演进（见[能力 seam 笔记](../../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.zh.md)）。两项决策锚定了该约定：

- **边界处的显式解析。** `resolve(request)` 是应用默认值与上限的唯一位置；`execute` 只接受已解析的 spec，绝不再次默认化，因此实现内部不会藏有隐藏的兜底值。
- **一次执行，多个投影。** `execute` 在准备完成后返回句柄；前台结果与后台游标读取都是同一个已 spawn 进程上的投影，前台/后台是调用方的选择，绝不是第二条 spawn 路径。句柄不带 id 或所有者；job 身份、所有权与生命周期属于通用 `ctx.jobs` 运行时，使执行器与会话保持独立。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `ShellExecutor` 服务与共享设置命名空间 |
| [`src/types.ts`](src/types.ts) | 请求/spec 词汇、`ShellExecution`、`ShellRunResult` 与沙箱事实 |
| [`src/render.ts`](src/render.ts) | `parseExitStatus`：shell 工具共享的退出状态标记约定 |

### 设置命名空间

`SHELL_SETTINGS_NAMESPACE` 由此处导出而非由某个提供方导出，因为它命名的是能力而不是实现：一个宿主只组装一个 `ctx.shell` 提供方，因此各提供方共享同一个命名空间而永不冲突，在平台间携带的设置文档也能在两边继续解析。

### 后台生命周期与归属

已 spawn 的进程属于 subprocess 服务而非执行器：它能在仅重载执行器后存活，并在组合拆解时被终止并 join。实现必须遵守 seam 的语义——`result()` 只在基础设施失败时 reject；句柄在准备完成后发布且其 `done` 绝不 reject（无论同步还是异步的 provider rejection 都把句柄结算为 `killed`、把不声明阶段的提示写入 stderr，同时 `result()` 以同一失败 reject；活句柄在本次执行自己的 `kill()` 或 abort 之后才到来的 rejection 则结算为其终态）；`readOutput` 是消费式的，有损读取会报告 spill 文件。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

None.

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `ShellExecutor` 服务与共享设置命名空间 |
| [`src/types.ts`](src/types.ts) | 请求/spec 词汇、`ShellExecution`、`ShellRunResult` 与沙箱事实 |
| [`src/render.ts`](src/render.ts) | `parseExitStatus`：shell 工具共享的退出状态标记约定 |

---

## 🔗 资源

当 seam 约定不够用时阅读以下页面。它们从共享子系统参考逐步进入具体执行器与面向模型的工具。

- [Bash 执行器子系统](../../../docs/subsystems/shell.zh.md) —— 请求/spec 词汇、结果与完整的服务约定。
- [bash-local](../bash-local/README.zh.md) —— 默认 POSIX 执行器：全新的 `bash -c` 进程、预算与 deadline。
- [bash-sandbox](../bash-sandbox/README.zh.md) —— 沙箱执行器：沙箱模式、拒绝与升权。
- [tool-bash](../tool-bash/README.zh.md) —— 基于该 seam 的面向模型 `bash` 工具。
- [能力 seam 笔记](../../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.zh.md) —— 本 seam 遵循的 Service Definition / Provider / Consumer 拆分。

---

## 🚀 快速开始

### 配置

```yaml
- id: bash
  name: '@deepseek-ai/dsh-bash-local'
  config:
    cwd: /path/to/workspace
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `ShellExecutor` 服务与共享设置命名空间 |
| [`src/types.ts`](src/types.ts) | 请求/spec 词汇、`ShellExecution`、`ShellRunResult` 与沙箱事实 |
| [`src/render.ts`](src/render.ts) | `parseExitStatus`：shell 工具共享的退出状态标记约定 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-shell
