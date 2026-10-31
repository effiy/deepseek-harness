---
title: "@deepseek-ai/dsh-jobs"
tags: []
category: "jobs"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-jobs` 让工具可以在 agent（智能体）继续推进时保持长时间工作运行。每项任务都会获得稳定的 `<kind>-N` id，拥有它的 agent 可以读取输出、带超时等待或请求取消。归属范围限定在 agent 会话内，因此其他 agent 无法查看或停止任务；任务完成时会通过会话内通知送达，无需轮询。用户可以查看保留的实时输出，而不消耗 agent 可读取的内容。只有部署提供任务执行能力时，后台任务才能启动。

---

## ⚡ 功能

### 限制

这些限制说明约定何时不合适。它们是当前包约束，不是任务积压。

- **约定是进程内的**——`JobSpec.run()` 传入回调，注册表解析拥有者会话背后的活体 `Agent`；持久化或跨进程后端必须先重塑身份、重启、所有权与观察语义，才能实现此 seam。
- **模型游标是唯一的消耗式读取**——独立观察者使用非消耗的 `readAt`，从不移动它。
- **已结算记录会一直列出直到被移除**——由持有者释放、服务释放，或收走它的调用方显式 `remove`；注册表不对已结算 job 保留任何数量上限。

---

## 📊 指标

通过生产方插件与控制器插件间接影响模型；它们负责基于任务注册表完成所有面向模型的渲染。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释约定背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

- **约定与实现分属不同包。** `JobRegistry` 是抽象 Cordis 服务；直接加载该类会抛出异常，因此错误配置的组合会在加载时失败，而不是注册一个空的 `ctx.jobs`。
- **每个进程一个注册表，按所有者返回结果。** 一个实例服务进程内的每套组合，因此注册与投递都相对注册方所在 scope：从不带 scope 的上下文注册的控制器或监听器服务于每个所有者；在某套 agent 组合的 scope 下注册的，恰好服务于该组合下组合出的 agent。
- **访问以所有者的会话 id 为界。** id 可预测，因此是授权——而非保密——构成边界。
- **结算首次优先，其事件跟在每个被释放的等待方之后。** 一条终止记录、释放的等待方，然后是一轮受到隔离的事件投递；`settled` 事件报告它是否释放了一个存活的 `wait`（`awaited`），因此无论是哪个插件在等待，`dsh-tool-jobs` 永远不会播报等待方已经收走的完成。
- **注册的存续期长于生产方与控制器 fiber。** 所有者与服务释放会取消正在运行的工作并等待守约的生产方；销毁期间的取消若抛出异常，只会将记录强制标记为失败。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `JobRegistry` 服务及其约定 |
| [`src/types.ts`](src/types.ts) | 共享词汇：`JobSpec`、`JobHandle`、`JobHooks`、`JobOutcome`、`JobEvent` 与读取结果 |
| [`src/view.ts`](src/view.ts) | 客户端安全叶子：`JobView`、`JobChunk`、`JobStatus` 与可合并扩展的 `JobKindMap` |
| [`src/brand.ts`](src/brand.ts) | `JobId` 带类型标记的标识符，无需 agent 依赖即可导入 |
| [`src/archive-admission.ts`](src/archive-admission.ts) | Workspace 注册表归档准入中的 `job` 族，由接缝构造函数为每个实现安装 |

### 服务操作

每个读取或控制操作接收可选的调用方 `SessionId`，省略时仅允许访问无主 job：`list` 与 `get` 返回全新投影，`read` 推进模型游标并在结算后把生产方的 result 交出一次，`readAt` 按绝对偏移读取保留块且不消耗任何东西，`kill` 在改变状态前调用生产方取消并为终态 `detail` 记录原因，`wait` 阻塞至超时，`remove` 丢弃调用方经自己的等待收走且从未交出的已结算记录，`start()` 在调用生产方 `run()` 一次之前预检访问、校验与准入，同时拒绝任何没有已附加控制器服务的所有者；`events.subscribe` 按所有者、scope 或进程粒度投递注册、进度、停止中、结算、移除与输出提交。

每个实现还会回答 Workspace 注册表的归档准入（[接缝](../../workspace/workspace/README.zh.md)），由接缝的构造函数只通过抽象的 `list` 与 `kill` 安装：`workspace/session-activity` 把被询问会话拥有的运行中或停止中任务作为 `job` 族报告，每个任务一项、附其 label；`workspace/session-stop` 以原因 `session archived` 逐个 kill 它们，因此一个在取消时抛错的生产方只记日志，该会话的其他任务仍会停止。无主任务不属于任何会话，绝不会为某个会话被报告或 kill。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `JobRegistry` 服务及其约定 |
| [`src/types.ts`](src/types.ts) | 共享词汇：`JobSpec`、`JobHandle`、`JobHooks`、`JobOutcome`、`JobEvent` 与读取结果 |
| [`src/view.ts`](src/view.ts) | 客户端安全叶子：`JobView`、`JobChunk`、`JobStatus` 与可合并扩展的 `JobKindMap` |
| [`src/brand.ts`](src/brand.ts) | `JobId` 带类型标记的标识符，无需 agent 依赖即可导入 |
| [`src/archive-admission.ts`](src/archive-admission.ts) | Workspace 注册表归档准入中的 `job` 族，由接缝构造函数为每个实现安装 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从任务类型逐步进入随附实现、模型侧控制与设计记录。

- [后台任务运行时子系统](../../../docs/subsystems/jobs.zh.md)——任务类型、投影字段与 `ctx.jobs` 的 Cordis 接口面。
- [jobs 组映射](../README.zh.md)——同级组页面及其包表格。
- [进程本地注册表](../jobs-local/README.zh.md)——在本进程中运行任务的随附实现。
- [模型侧任务控制](../tool-jobs/README.zh.md)——`job_output`、`job_list` 与 `job_kill` 工具及完成通知。
- [Jobs 生命周期与输出归属](../../../.agents/notes/implemented/architecture/2026-09-03-jobs-seam-consolidation.zh.md)——一套生命周期、输出环与观测流。
- [任务注册表 seam Agent Note](../../../.agents/notes/archived/architecture/2026-07-26-job-registry-seam.md)——按所有者隔离的注册表约定及其理由。
- [jobs seam 收敛 Agent Note](../../../.agents/notes/implemented/architecture/2026-09-03-jobs-seam-consolidation.zh.md)——一个输出环、一个投影、一条事件流。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-jobs-local'
- name: '@deepseek-ai/dsh-tool-jobs'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `JobRegistry` 服务及其约定 |
| [`src/types.ts`](src/types.ts) | 共享词汇：`JobSpec`、`JobHandle`、`JobHooks`、`JobOutcome`、`JobEvent` 与读取结果 |
| [`src/view.ts`](src/view.ts) | 客户端安全叶子：`JobView`、`JobChunk`、`JobStatus` 与可合并扩展的 `JobKindMap` |
| [`src/brand.ts`](src/brand.ts) | `JobId` 带类型标记的标识符，无需 agent 依赖即可导入 |
| [`src/archive-admission.ts`](src/archive-admission.ts) | Workspace 注册表归档准入中的 `job` 族，由接缝构造函数为每个实现安装 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-jobs
