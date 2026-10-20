---
title: "@deepseek-ai/dsh-sandbox"
tags: []
category: "sandbox"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用 `dsh-sandbox`，可以让子进程及其派生的所有进程在逐调用文件访问策略下运行。命令可以禁止写入（`read-only`）、只写入工作区（`workspace-write`），或不受限制地运行（`danger-full-access`）。无法强制执行所请求的模式时，调用以 `SANDBOX_UNAVAILABLE` 失败，绝不会不受限制地运行。调用被拒绝后，模型可以请求一个严格更宽的模式，交由人类批准一次。这种限制只适用于与宿主共享内核和文件系统的进程；需要隔离整个环境时，请使用容器、microVM 或远程执行器。

---

## ⚡ 功能

### 适用场景

当组合需要在宿主机上隔离子进程时选择本包：本地后端与受限执行器都实现这个约定，因此在 `ctx.sandbox` 后挂载 `sandbox-local`、在 `ctx.shell` 后挂载受限执行器，就能使每次 bash 或 pwsh 调用默认在限制下运行。当进程必须在隔离环境中运行时请另选方案——容器、microVM 或远程执行器会替换整个 `ctx.shell`/`ctx.fs` 能力，而不是在这里添加后端。

### 限制

这些限制说明该 seam 何时不合适，或何时需要特别运维。它们是当前包约束，不是通用沙箱对比或任务积压。

- **文件操作是完整的策略词汇**——该 seam 不表达网络、进程、系统调用、设备或凭据限制。
- **只支持与宿主共享文件系统和内核的限制**——容器、microVM 与远程执行需要替换能力实现，而不是在此添加提供方。
- **拒绝报告是一种 stderr 方言**——该 seam 返回后端签名，而非类型化运行时拒绝通道，需要分类的消费方必须从子进程输出推断。
- **Runner 诊断使用带内通道**——退出状态与 stderr 证据无法证明匹配行由哪个进程写入，因此故意模仿 runner 的受限子进程可能造成错误的可用性或诊断归因；这无法绕过隔离，带外 runner 状态通道暂缓实现。
- **每个上下文只有一个提供方**——同时组合不同沙箱机制需要提供方级阶梯或独立 Cordis 上下文；调用方逐调用选择策略，而非后端标识。

---

## 📊 指标

### 间接的限制错误

#### 模型看到什么

通过 [`dsh-bash-sandbox`](../../shell/bash-sandbox/README.zh.md) 和 [`dsh-tool-bash`](../../shell/tool-bash/README.zh.md)，请求的受限模式没有可用后端时会产生错误码 `SANDBOX_UNAVAILABLE` 及下方精确错误；执行期 runner 失败会追加 ` Runner failure: <detail>`。

##### 精确错误

```markdown
sandbox mode "<mode>" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. Install bubblewrap or run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS), or ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer to danger-full-access.
```

#### Token 影响

条件性错误文本对该次调用可见，并保留在历史中直到压缩（compaction）。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

### 升权请求与结果

#### 模型看到什么

被拒绝的调用会呈现标记 `[sandbox: file access denied under <mode> mode]`，组合声明升权能力时还会呈现提示 `[sandbox: escalation available — retry this exact <subject> once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]`。重试携带 `sandbox_permissions` 与 `justification`；用户的 `allowed-once`／`rejected`／`cancelled` 决定成为该调用的结果文本。

#### Token 影响

只有被拒绝调用的错误与任何升权结果文本可见；两者都会保留在历史中直到压缩。

#### KV Cache 影响

仅追加；升权文本位于保留前缀之后，不会使已缓存条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释约定背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

- **同一执行环境。** 文件系统、子进程与沙箱提供方使用同一文件系统和内核。远端组合替换这三个提供方，并在该环境中异步解析限制。
- **策略随调用传递。** `SandboxPolicy` 逐调用携带，绝不在提供方上固定：两个消费方可以同时按不同策略隔离，获批的升权重试只是用更宽策略发起的新调用。默认与解析是消费方显式步骤。
- **故障关闭。** `confine()` 异步返回用于强制执行限制的 argv，或以 `SandboxUnavailableError` 拒绝；绝不允许静默无限制放行，功能探测用于仲裁多 runner 链。
- **统一的拒绝与升权词汇。** 标记与提示文本以及严格更宽阶梯都放在这里，使 bash 与 fs 家族不会漂移。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SandboxProvider` 服务、模式/强制执行/策略类型、故障关闭错误 |
| [`src/escalation.ts`](src/escalation.ts) | 升权词汇：更宽模式阶梯、参数校验、拒绝与提示标记、审批编排 |
| [`src/roots.ts`](src/roots.ts) | 可写根目录推导，Seatbelt profile 与进程内 fs 栅栏共享 |

### 升权编排

阶梯是封闭表——`read-only` 可升权到 `workspace-write` 或 `danger-full-access`，`workspace-write` 只能升权到 `danger-full-access`——在执行时检查，绝不写入工具 schema，schema 的枚举保持封闭的目标词汇。[`approveEscalation`](src/escalation.ts) 在请求重复当前模式时无需审批就返回该模式，拒绝更窄或不支持的目标，并为更宽模式请求审批。调用方先校验 `sandbox_permissions`/`justification` 配对。

### 可写根目录

`workspace-write` 意味着「工作区根目录加宿主临时区域」：`writableRoots` 以规范化方式推导该白名单，解析符号链接并去重，使 Seatbelt profile 与进程内 fs 栅栏授予完全相同的根目录。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：未决方向与开放问题。它明确不具权威性——已交付的行为、限制与既定理由以上文、包代码和相关 Agent Note 为准。

#### 未来：消费方与环境

可选的 `subagent-acp` 消费方（隔离子 agent，默认不隔离）与环境一致的能力组示例仍未决定。Windows 隔离由 `sandbox-local` 的 ACL 受限令牌后端提供。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SandboxProvider` 服务、模式/强制执行/策略类型、故障关闭错误 |
| [`src/escalation.ts`](src/escalation.ts) | 升权词汇：更宽模式阶梯、参数校验、拒绝与提示标记、审批编排 |
| [`src/roots.ts`](src/roots.ts) | 可写根目录推导，Seatbelt profile 与进程内 fs 栅栏共享 |

---

## 🔗 资源

先从子系统参考文档了解穷尽式约定，再看实现它的后端、消费方与策略来源。

- [进程沙箱子系统](../../../docs/subsystems/sandbox.zh.md)——完整词汇、逐调用策略与分类方言。
- [历史子进程沙箱决策](../../../.agents/notes/archived/feature/2026-07-06-sandbox.md)——能力边界、升权设计与延期阶段。
- [本地沙箱后端](../sandbox-local/README.zh.md)——`ctx.sandbox` 背后的各平台 runner。
- [Bash 沙箱执行器](../../shell/bash-sandbox/README.zh.md)——受限的 bash 消费方。
- [沙箱策略包](../sandbox-policy/README.zh.md)——逐调用模式与工作区根目录的来源。

---

## 🚀 快速开始

### 配置

```yaml
- id: sandbox
  name: '@deepseek-ai/dsh-sandbox-local'     # the per-platform backend provider (ctx.sandbox)
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'    # the deployment default mode and workspace-write root
  config:
    mode: workspace-write                    # the deployment default every session starts from
    workspaceRoot: !!js process.cwd()        # the boundary workspace-write may write under
- id: bash
  name: '@deepseek-ai/dsh-bash-sandbox'      # the confined executor behind ctx.shell
```

### 参数

| 模式 | 效果 |
|---|---|
| `read-only` | 拒绝写入，必需 sink（如 `/dev/null`）除外 |
| `workspace-write` | 允许写入工作区根目录及后端定义的临时区域 |
| `danger-full-access` | 绕过隔离；消费方直接 spawn 原始 argv |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-sandbox
