---
title: "@deepseek-ai/dsh-tool-bash"
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

`dsh-tool-bash` 运行 Bash 命令并返回 stdout、stderr 与退出标记。每次调用使用全新 shell；cwd、变量和函数不会保留。组合中有 job 注册表时，每条命令从启动起就是一个 job：`run_in_background` 立即返回 id，超过超时仍在运行的前台命令返回同一个 id，`job_output`/`job_kill` 收集并停止它。命令获得受管 `DSH_*` 环境；沙箱拒绝可携带更宽的 `sandbox_permissions`、一句 `justification` 与用户批准重试一次。非零退出是供 agent（智能体）解读的结果。请将 `dsh-bash-local` 或 `dsh-bash-sandbox` 等执行器与 `dsh-shell-env` 一起挂载。

---

## ⚡ 功能

### 限制

这些限制说明工具何时不合适或需要特别小心。它们是当前包约束，不是任务积压。

- **回放的退出 pill 从结果文本解析**——输出最后一行恰好是 `[exit code: N]` / `[killed by signal: …]` 时，会话回放会显示错误的 pill 并从卡片正文丢失该行，因为解析把它当作要消费的标记；这是仅影响显示的已知残留。
- **`bash` 工具不参与 `timeout-policy` 预算**——它保留执行器自有的 `BASH_TIMEOUT` 路径，见[工具调用超时策略 Agent Note](../../../.agents/notes/implemented/architecture/2026-07-07-tool-call-timeout-policy.zh.md)。
- **后台进程没有执行器超时**——工作不再需要时，调用方必须使用 `job_kill`，或依赖持有者／服务的释放；登记为任务的前台命令同样没有，它的超时只限定等待时长。
- **任务列表会显示每条运行中的前台命令**——完成的命令随结果离开，但 Web 任务列表尚未标出哪些运行中的行仍有工具调用在等待。

---

## 📊 指标

### 系统提示词

#### 模型看到什么

以下 bash 指引会以第一方顺序值 1000 出现在该插件注册作用域内的每次请求中。策略归属方通过其缓存安全的运行时上下文贡献当前沙箱状态，而不修改本区段。按作用域实施的工具限制可以隐藏 schema，却不会移除这个独立注册的区段。

##### Bash 指引

```markdown
Check the [exit code: N] marker on every bash result; investigate failures before moving on.
```

#### Token 影响

插件激活期间，每次请求都会产生少量固定的输入 token 开销，不随沙箱模式或模式切换而变。

#### KV Cache 影响

只要注册作用域与提示词文本不变，前缀就保持稳定。插件激活或释放可能使从该提示词区段起的复用失效；沙箱模式切换不会。

### 工具 schema

#### 模型看到什么

模型会看到生成的 [`bash` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-bash)。仅当本生产方启用 `run_in_background` 且组合中有 job 注册表时，该字段才会出现；仅当已挂载执行器声明支持沙箱时，`sandbox_permissions` 和 `justification` 才会出现；理由字段提示模型使用用户当前提问的语言。按 agent 作用域限制工具可以移除该 agent 的定义。

#### Token 影响

工具可见的每个请求都会产生固定 schema 开销；沙箱支持会增加升权字段及其条件说明段落。

#### KV Cache 影响

只要可见性、后台支持与执行器沙箱能力不变，前缀就保持稳定。限制、配置或执行器发生变化时，可能从首个变化的工具定义开始使复用失效。

### 前台结果

#### 模型看到什么

renderer 输出依数据而定的 stdout 尾部，再输出可选的 `[stderr]` 和 stderr 尾部。没有输出时，它精确输出 `(no output)`。条件行精确为 `[output truncated; full output: <path-or-(unavailable)>]`、`[sandbox: file access denied under <mode> mode]`、`[timed out after <timeoutMs>ms]`、`[stopped: <reason>]`、`[killed by signal: <signal>]` 与 `[exit code: <exitCode>]`；沙箱升权与 runner 故障行原文列于 [`dsh-bash-sandbox`](../bash-sandbox/README.zh.md)。

#### Token 影响

调用前的结果 token 为零。每条流的输出有界，每个已输出行则会保留在历史中，直至压缩（compaction）。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV-cache 条目失效。

### 后台任务上下文与结果

#### 模型看到什么

启动会精确返回 `started background job <jobId>`。本生产方会向通用任务运行时提供增量进程输出、可选的 `[some output was dropped from memory; full output: <paths-or-(unavailable)>]`、沙箱事实，以及 `exit code: <exitCode>` 或 `signal: <signal>` 等终止详情。[`dsh-tool-jobs`](../../jobs/tool-jobs/README.zh.md) 负责模型可见的状态行、完成通知、列表和取消响应。

#### Token 影响

启动确认很短且会保留；收集到的输出依数据而定，并受执行器流缓冲区限制。消费式读取不会重复先前输出。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV-cache 条目失效。

### 工具错误

#### 模型看到什么

验证与策略失败统一为 `Error: <message>`。本包的稳定消息包括 `invalid command: expected a non-empty string`、`invalid description: expected a non-empty string`、`invalid timeoutMs: expected a positive number, got <value>`、升权配对失败、`run_in_background is disabled for this deployment (enableRunInBackground: false)`、`background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs`、`sandbox_permissions is not available in this composition (no sandboxing executor to escalate)`、审批不可用／拒绝／取消变体，以及 `tool call aborted`。

#### Token 影响

只有失败调用会增加这些保留 token；升权被拒时命令不会运行，因此不会添加命令输出。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV-cache 条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

前台与后台的结构化结果均包含 `cwd`，即执行器解析后的启动目录。持久化展示元数据携带同一值，使已结束的调用卡片保留该次调用使用的目录。命令内部的 `cd` 不会改变这个启动值；原生结果文本仍由 stdout、stderr 与状态标记组成。

本节解释工具背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

- **shell seam 的模型侧消费方。** 本工具是 bash 能力的消费方角色：它注册 `bash` schema、渲染结果并解析每次调用的策略，进程机制归执行器 seam 所有。
- **请求只来自命名参数。** 工具从不暴露 `stdin`、`env` 或 `stdoutMaxBytes`；它只用命令／workdir／超时／信号字段加上注册表收集的 `dshEnv` 构建每个请求，因此模型提供的键无法替换受管值。
- **非零退出只报告、不失败。** 只有基础设施故障（spawn 错误、中止）才会作为工具错误暴露；模型解读退出码与标记。
- **组合了任务运行时，每条命令都归它。** 调用一启动就把进程句柄注册到 `ctx.jobs`，无论是模型要求后台还是工具在等待它；job id、所有权、完成通知与释放都是运行时的职责，本工具只把 bash 退出与沙箱事实映射为任务输出。没有注册表时工具只做前台，并随注册表的出现与消失在两种注册之间切换。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：工具注册、提示词区段、参数校验、升权、请求组装 |
| [`src/background.ts`](src/background.ts) | 管理异步 shell 准备、将进程结算映射为任务结果，并把输出环读取渲染为进程读取 |
| [`src/render.ts`](src/render.ts) | 模型侧结果文本：流、标记、截断通知 |

### 请求解析

工具在 `ctx.shell.resolve()` 运行前解析 workdir：显式的相对 `workdir` 相对 Session 当前目录解析，与沙箱权限根目录独立。沙箱策略通过 `ctx.sandboxPolicy` 按调用解析；升权请求在任何执行前经由 `ctx.approval`，若执行器会约束命令却没有挂载策略服务，工具在加载时失败。

### 渲染故事

结果文本为 stdout，然后是带标记的 `[stderr]` 区段，再是条件标记：截断通知、沙箱拒绝（组合声明升权时附带同轮次升权提示）、超时、信号与退出码——每个占一行。退出标记同时充当 UI 卡片的退出状态 pill：`dsh-shell` 共享的 `parseExitStatus` 会从输出体中消费它，因此回放显示 pill 而不重复标记。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：工具注册、提示词区段、参数校验、升权、请求组装 |
| [`src/background.ts`](src/background.ts) | 管理异步 shell 准备、将进程结算映射为任务结果，并把输出环读取渲染为进程读取 |
| [`src/render.ts`](src/render.ts) | 模型侧结果文本：流、标记、截断通知 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从 shell 家族逐步进入执行器 seam、任务运行时，以及行为背后的决策笔记。

- [shell 包映射](../README.zh.md)——bash 能力家族及其角色。
- [Bash 执行器子系统](../../../docs/subsystems/shell.zh.md)——请求／spec 词汇、结果与后台进程。
- [shell-env](../shell-env/README.zh.md)——每次调用都会收到的受管 `DSH_*` 环境。
- [tool-jobs](../../jobs/tool-jobs/README.zh.md)——后台运行的 `job_output`、`job_list` 与 `job_kill` 控制。
- [历史沙箱 Agent Note](../../../.agents/notes/archived/feature/2026-07-06-sandbox.md)——升权与模式切换的理由。
- [生成的工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-bash)——`bash` 参数 schema 的确切内容。
- [生成的配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-tool-bash)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-bash-local'
- name: '@deepseek-ai/dsh-shell-env'
- name: '@deepseek-ai/dsh-tool-bash'

# Optional: background jobs
- name: '@deepseek-ai/dsh-jobs-local'
- name: '@deepseek-ai/dsh-tool-jobs'
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `enableRunInBackground` | `true` | 组合中有 job 注册表时暴露 `run_in_background`；为 `false` 时拒绝强制后台调用 |
| `promoteOnTimeout` | `true` | 到达超时的前台命令继续作为它的后台任务运行，而不是杀掉它 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-tool-bash
