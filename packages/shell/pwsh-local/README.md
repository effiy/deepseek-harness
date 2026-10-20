---
title: "@deepseek-ai/dsh-pwsh-local"
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

`dsh-pwsh-local` 是 PowerShell 执行器：每条命令都以全新的非交互 `pwsh -Command` 进程运行，不加载 profile 文件，因此调用之间不会残留任何 shell 状态。它逐调用镜像 `dsh-bash-local` 的语义，并额外负责 PowerShell 层事项：可执行文件解析、UTF-8 输出固定与面向模型的终端环境。命令以 harness 进程自身的权限运行——本执行器不做任何隔离；需要沙箱能力时请组合 `dsh-pwsh-sandbox`。挂载后，面向模型的 `pwsh` 工具会与它对接。

---

## ⚡ 功能

### 适用场景

它是 `dsh-bash-local` 的 Windows 对应实现：当 `pwsh` 是平台 shell 时选择它，组合即可把 POSIX 行换成 pwsh 行并保持相同的语义。执行器从显式 `pwshPath`、常见的 Windows 安装位置、PATH 条目，或作为最后手段的 Windows PowerShell 5.1 解析 `pwsh` 可执行文件。非隔离执行时它就是默认选择；需要沙箱能力时组合 `dsh-pwsh-sandbox`。

### 限制

这些限制说明本执行器何时不合适。它们是当前包约束，不是路线图。

- **自身不提供隔离**——命令以 harness 进程的权限运行；需要隔离的部署组合沙箱执行器或策略。
- **没有持久 shell 或 PTY**——每次调用都启动全新的 `pwsh -Command`。
- **命令字符串是 PowerShell 文本**——`-Command` 域没有 shell 引号层，但面向模型的命令由 PowerShell 自己解析，因此 PowerShell 语法错误是命令失败，而非启动失败。
- **后台提供方失败提示就是整条 stderr 流**——`SubprocessHandle.done` 可能在目标命令开始执行前或后被拒绝，而 subprocess 服务不会为从未上报结果的目标命令 缓冲任何输出，因此执行器把不声明失败阶段的 `subprocess failed before reporting an outcome: …` 作为观测到的 stderr 流提供（偏移读取方按各自偏移重读），并只折入恰好一个 `readOutput()` 增量；丢弃了该增量的消耗式读取方只能经 `observed.stderr` 恢复它。
- **Windows 终止不报告信号**——被强制终止的进程以退出码 1、`signal: null` 结算，因此基于信号的状态分类在 Windows 上不适用；`kill()` 发起的停止仍会直接标记为 `killed`。
- **编码 preamble 位于命令之前**——PowerShell 要求 `param(...)`、`#requires` 与 `using` 语句位于脚本最顶部，因此以其中一种开头的命令无法在 UTF-8 输出 preamble 下运行；`param(...)` 脚本请包进 `& { … }`，`using`/`#requires` 脚本请改从文件运行。
- **Windows PowerShell 5.1 下的非 ASCII stdin 可能被错误解码**——preamble 只固定输出编码；`[Console]::InputEncoding` 保持主机默认，因为在重定向 stdin 下设置它会抛出异常；pwsh 7 默认 UTF-8，不受影响。

---

## 📊 指标

通过 `dsh-tool-pwsh` 间接影响；该工具会渲染本执行器有界的 stdout/stderr 尾部、后台进程增量（经通用任务运行时）、spill 文件路径与基础设施失败。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀的任何变更由具名消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释执行器的设计并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计概念

本执行器是基于 subprocess 能力的 `ctx.shell` seam 的 PowerShell Service Provider：它负责所有 pwsh 层职责——可执行文件解析、命令默认化与上限、deadline 融合与原因分类、UTF-8 输出固定、面向模型的终端环境，以及后台读取合并——而 managed-range 机制（有界 spill 输出、凭据清除、终止升级、完全停稳与 dispose（资源释放））属于 subprocess 服务。每次调用都 spawn 全新的非交互 `pwsh -Command`，并带 `-NoLogo -NoProfile -NonInteractive`，因此命令是确定性的，profile 状态绝不会在调用之间泄漏。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`PwshLocalExecutor`、`Config`、设置接线、argv seam |
| [`src/resolve.ts`](src/resolve.ts) | 纯函数 `resolvePwshPath`/`candidatePwshPaths` 可执行文件解析 |
| `tests/` | 已演练的行为：预算、分类、解析、后台句柄 |

### 主要流程

一次调用分三步：`resolve()` 从配置填充 `workdir`/`timeoutMs`/`stdoutMaxBytes`（并限制每次调用的 `timeoutMs` 覆盖值）；执行器构建 pwsh argv——`pwsh -NoLogo -NoProfile -NonInteractive -Command <编码 preamble + 命令>`——把按配置钳位的超时与调用方的中止信号融合为一个 deadline，再以显式字节上限与 `graceMs` 通过 `ctx.subprocess` spawn；结算的结果被分类并投影为 `ShellRunResult`。Windows 把强制终止报告为退出码 1 且无信号，因此带信号标记的事实在那里仅限 POSIX；超时/取消分类则与平台无关。

前台 deadline 从 argv 准备开始，并在准备与执行之间保持同一信号和剩余预算。准备阶段超时返回空输出、`timedOut: true`，且 `exitCode` 和 `signal` 均为 `null`；调用方在发布进程前取消仍会拒绝调用。准备晚到的成功或失败不会触发 spawn。

### 不变式与归属

- `graceMs` 预算必须为正有限值且不大于 `MAX_TIMER_DELAY_MS`，这样 Node 就能用一个定时器表示它；无效值在写入处被拒绝。
- 环境分层固定：先是终端覆盖值，然后是调用方的 `env`，最后才是受信任的 `dshEnv` 快照；subprocess 服务独立清除环境中的凭据与继承的 `DSH_*` 名称。
- 可执行文件解析是 `(configured, env, platform)` 的纯函数，仅当存储的 `pwshPath` 与当前可执行文件所依据的值不同时才重新探测文件系统。
- 后台进程属于 subprocess 服务：它能在仅重载执行器后存活，并在服务 dispose 时被终止并 join。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`PwshLocalExecutor`、`Config`、设置接线、argv seam |
| [`src/resolve.ts`](src/resolve.ts) | 纯函数 `resolvePwshPath`/`candidatePwshPaths` 可执行文件解析 |
| `tests/` | 已演练的行为：预算、分类、解析、后台句柄 |

---

## 🔗 资源

当执行器约定不够用时阅读以下页面。它们从 seam 延伸到提供隔离的同类包与 PowerShell 工具。

- [shell seam](../shell/README.zh.md) —— 本提供方实现的执行器约定，包括请求/spec 拆分。
- [bash-local](../bash-local/README.zh.md) —— 本执行器逐调用镜像的 POSIX 对应实现。
- [pwsh-sandbox](../pwsh-sandbox/README.zh.md) —— 需要沙箱能力时改为组合的隔离执行器。
- [tool-pwsh](../tool-pwsh/README.zh.md) —— 基于本执行器的面向模型 `pwsh` 工具。
- [Bash 执行器子系统](../../../docs/subsystems/shell.zh.md) —— 请求/spec 词汇、结果与完整的服务约定。

---

## 🚀 快速开始

### 配置

```yaml
- id: bash
  name: '@deepseek-ai/dsh-pwsh-local'
  config:
    cwd: C:\path\to\workspace
    timeoutMs: 120000
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `cwd` | `process.cwd()` | 命令的默认工作目录 |
| `timeoutMs` | `120,000` | 默认前台超时，单位为毫秒 |
| `maxTimeoutMs` | `600,000` | 每次调用超时覆盖值的上限 |
| `maxOutputBytes` | `64,000` | 每流内存输出上限；溢出后 spill 到临时文件 |
| `maxSpillBytes` | `67,108,864` | 每流完整输出的 spill 上限 |
| `graceMs` | `3,000` | 终止升级与退出后管道排空的宽限时间 |
| `pwshPath` | 自动解析 | 显式 pwsh 可执行文件；否则依次探测常见位置，再查 PATH |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-pwsh-local
