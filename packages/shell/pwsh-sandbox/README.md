---
title: "@deepseek-ai/dsh-pwsh-sandbox"
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

`dsh-pwsh-sandbox` 是沙箱消费型 PowerShell 执行器：每条命令都以全新的 `pwsh -Command` 进程运行，经 `ctx.sandbox` 能力隔离，并在每个已结算的结果上标记所选模式、强制执行完整度与拒绝事实。在 Windows 上，沙箱 seam 解析到 ACL 受限令牌 runner 链；在 Linux 与 macOS 上则使用 bwrap、Landlock 或 Seatbelt。当没有 runner 能强制执行受限模式时，调用按失败关闭原则抛结构化 `SANDBOX_UNAVAILABLE` 错误，绝不无隔离地运行。它是 `dsh-bash-sandbox` 的 pwsh 孪生，逐调用镜像。

---

## ⚡ 功能

### 适用场景

当部署需要为 PowerShell 命令提供文件级隔离时选择它，通常是在 Windows 上。隔离实体本身是平台无关的：沙箱 seam 选择平台的 runner——Windows 上是 ACL 受限令牌链，其他平台是 bwrap/Landlock/Seatbelt——而本执行器只负责 pwsh 侧。沙箱策略（模式加工作区根目录）不是本包的配置：它随每次调用从 `ctx.sandboxPolicy` 而来，工具调用传调用会话解析后的策略，直接调用回退到部署策略。

### 限制

这些限制说明本执行器在 Windows 上只是不完整的边界。它们是当前包约束，不是路线图。

- **Windows 上读不受限**——ACL runner 只限写；读边界文档在 `@deepseek-ai/dsh-sandbox-windows-acl`。
- **Windows workspace-write 的临时权限按每个活跃的会话/工作区对私有**——无 agent（智能体）的调用每次都获得一个新的私有目录；环境临时根目录绝不会被授权，runner 会在 spawn 前将 `TMP`/`TEMP` 重写为该私有目录。
- **Windows read-only 不授予任何显式可写根目录，但仍为部分强制执行**——NTFS 硬链接会把同一文件对象别名为多个路径、读取仍不受限，且被其他 AppContainer 工具以包 SID 标记过的目录树对 Low 完整性子进程不可读。NUL 在两种模式下仍可写，因为设备 DACL 向 Everyone 授予写权限且不带更高的标签；PowerShell 的 `> $null` 重定向仍然工作，且不会打开 NUL。

---

## 📊 指标

### 隔离生效，拒绝以命令失败呈现

#### 模型看到的内容

受限命令自身的 stderr——例如 Windows ACL runner 下的 `Access to the path '...' is denied.`；工具层把分类后的拒绝转成标准权限拒绝面，与 bash 工具完全一致。

#### Token 影响

除命令 stderr 与工具层标准拒绝面外，无额外模型可见文本。

#### KV Cache 影响

无直接影响；拒绝呈现面属于工具层。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释执行器的设计并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计概念

本执行器是 `dsh-bash-sandbox` 的 pwsh 孪生：它继承 `dsh-pwsh-local` 的进程机制，消费其 argv 级 seam（`argv()`/`executeArgv()`/`onProcessDone()`），并在 spawn 前把精确的 pwsh 调用经 `ctx.sandbox.confine()` 包装。隔离实体本身是平台无关的——沙箱 seam 解析到平台的 runner——而本包只负责 pwsh 侧：所选模式、强制执行完整度，以及结果上的拒绝分类。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SandboxPwshExecutor`、按进程保留事实、执行准备 |
| [`src/helpers.ts`](src/helpers.ts) | 拒绝、runner 失败与 runner spawn 失败分类 |
| `tests/` | 跨 ACL 与平台 runner 演练的行为 |

### 主要流程

对受限模式，`resolve()` 标记每次调用的策略；`execute` 把 pwsh argv 经提供方包装，再把受限 argv 交给继承的子进程路径。结算时执行器对结果分类：runner 失败优先于拒绝（命令从未运行），stderr 携带 runner 拒绝方言的失败运行报告 `denied: true`，每次受限运行都携带模式与强制执行事实。`danger-full-access` 完全绕过提供方，并标记 `denied: false`。

### 不变式

- **失败关闭**——受限模式没有可用 runner 时以 `SANDBOX_UNAVAILABLE` 拒绝；受限策略绝不会出现无隔离直通。
- **seam 只报告拒绝**——本执行器从不授予权限；批准流程位于工具层。
- **按进程保留事实**——隔离事实在结算前按句柄保留，因为提供方在不同的重叠调用中可能采用不同的强制执行方式。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SandboxPwshExecutor`、按进程保留事实、执行准备 |
| [`src/helpers.ts`](src/helpers.ts) | 拒绝、runner 失败与 runner spawn 失败分类 |
| `tests/` | 跨 ACL 与平台 runner 演练的行为 |

---

## 🔗 资源

当执行器约定不够用时阅读以下页面。它们从 seam 进入隔离后端与 pwsh 工具。

- [shell seam](../shell/README.zh.md) —— 本提供方实现的执行器约定，包括请求/spec 拆分。
- [bash-sandbox](../bash-sandbox/README.zh.md) —— 本执行器的 bash 孪生，共享拒绝与升权面。
- [pwsh-local](../pwsh-local/README.zh.md) —— 本执行器继承的进程机制。
- [sandbox-windows-acl](../../sandbox/sandbox-windows-acl/README.zh.md) —— Windows 受限令牌 runner 链。
- [Bash 执行器子系统](../../../docs/subsystems/shell.zh.md) —— 请求/spec 词汇、结果与完整的服务约定。
- [pwsh 执行器与工具笔记](../../../.agents/notes/archived/feature/2026-08-01-pwsh-tool-and-executor.md) —— pwsh 执行器与工具这一对背后的决策。

---

## 🚀 快速开始

### 配置

```yaml
- id: sandbox
  name: '@deepseek-ai/dsh-sandbox-windows-acl'
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: read-only
    workspaceRoot: !!js process.cwd() # fallback for calls without a session cwd
- id: bash
  name: '@deepseek-ai/dsh-pwsh-sandbox'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SandboxPwshExecutor`、按进程保留事实、执行准备 |
| [`src/helpers.ts`](src/helpers.ts) | 拒绝、runner 失败与 runner spawn 失败分类 |
| `tests/` | 跨 ACL 与平台 runner 演练的行为 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-pwsh-sandbox
