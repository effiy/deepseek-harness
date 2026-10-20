---
title: "@deepseek-ai/dsh-subagent"
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

`dsh-subagent` 通过具名提供方委派工作，并收集受管理 activation 的结果。本地 spawn 和 fork 子级保留持久会话以接受后续消息；ACP、DSH SDK、Codex 与 Claude Code 执行一次。所有子级共享准入、取消、所有权与发现机制。使用时组合服务、提供方和委派工具。

---

## ⚡ 功能

### 限制

这些限制说明该 seam 何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是通用委派对比或任务积压。

- **后代读取串行执行**——每个可达目录（包括一次性子级）都需要一次观察。冷 Session 缺少有效的 prepared 观察时需要读取完整日志；大型冷会话树可能累积存储延迟。
- **外部子级执行一次**——ACP、DSH SDK、Codex 与 Claude Code 没有本地子 Session，也不接受后续输入。释放后仍可发现父级拥有的执行记录。
- **仅允许相邻模型消息**——`sendMessage()` 要求确切在线 sender；每个 sender 都可以指定直接可继续 child，只有具备驻留可继续 Activation 的 sender 可以指定自己的直接 parent。浏览器提示使用独立的人类 Queue 或 Steer 控制路径。
- **child 到 parent 的投递要求直接 parent 保持在线**——服务没有持久 parent mailbox；parent 缺失时会拒绝消息，而非接受无法唤醒的工作。
- **取消收敛期间存在唤醒缺口**——中断信号发出后、Agent 进入 idle 前被接受的后续消息会保持排队，直到另一条唤醒发送到达。
- **待处理的注入上下文会保留 Activation**——settlement 会保守地把每个 Inbox occurrence 都视为未完成。Agent 进入 idle 后停放的上下文会让 child 及其在线祖先继续驻留，直到唤醒投递将其 claim、queue 变更将其移除，或 manager teardown 将其丢弃。宿主完成检查等待活动工作、待创建子级与资源清理，但不会等待仅包含空闲停放 Inbox 的子树；它既不结算这些 activation 的结果，也不丢弃其消息。
- **驻留仅限进程内**——Activation inbox 与所有权图不会在两个 harness 进程之间协调；对单个持久化存储的并发访问需要持久化邮箱与跨进程租约协议。
- **不回放已接受但未记录的消息**——崩溃可能丢失从未写入子会话日志、已被接受的提示词；丢失的消息不会自动回放。
- **没有持久化 parent mailbox**——child 到 parent 的消息要求驻留的可继续 child 与在线直接 parent，提供的是接受标识，不保证恰好一次投递。
- **生命周期事件只供观察**——影响运行的 `subagent/end` 延续或决策接口仍需等待具体消费方。

---

## 📊 指标

### 结算通知

#### 模型看到什么

父级投递发送包含子级最终输出中非空文本块的 user-role 状态通知，不受 `send_message` 是否可用或是否调用影响。外部通知还说明不支持后续消息。推理及其他非文本块被排除。每条父级通知都会以 `Structured result: <JSON>` 附带可用的结构化输出，并以独立文本块附带提供方安全诊断。收尾文本为空时，通知使用 `It left no closing message.`。调用方投递不发送通知；清理成功时 SDK 生命周期通知保留完整子级输出。

#### Token 影响

父级投递为每个结算的 activation 添加一条通知。调用方投递不添加完成消息，由其消费者负责展示结果。

#### KV Cache 影响

在父级中仅追加：通知位于其可复用请求前缀之后。到达空闲父级会启动一次独立的模型请求，到达繁忙父级则不会。

### 子级委派范围声明

#### 模型看到什么

每个进程内子 agent 的运行时上下文快照都携带下方的 `subagent:delegation` 声明，位于沙箱策略与审批策略语句之后。

##### 委派范围声明

```markdown
You are a delegated subagent: your permission scope was fixed when you were started and cannot be widened from inside this session — operations that require approval are rejected automatically. When the job needs access beyond that scope, do not retry the denied operation; state the limitation in your reply so the delegating agent can handle it.
```

#### Token 影响

每个子 agent 的运行时上下文快照中一条固定声明；父级请求中没有任何新增。

#### KV Cache 影响

子级内部前缀稳定：该声明在子 agent 生命周期内绝不变化，因此只写入第一份运行时上下文快照一次。父级侧不会直接使缓存失效；具名工具消费方共同负责请求前缀的任何变化。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释服务的构建方式以及可观察行为从何而来；完整约定见[使用本包](#use-this-package)。

### 设计理念

- **一个服务，多个提供方。** 服务是具名提供方注册表；每个后端以唯一名称注册，请求按名称选择一个。
- **统一受管理生命周期。** `SubagentManager` 统一管理启动、消息准入、容量、父子关系与释放。每条 activation 直接持有本地 AgentHandle 或外部 SubagentRun；本地 inbox 与空闲状态仅属于本地分支。
- **兑现即发布。** `startActivation()` 仅在子级已接受且句柄可取消该次执行后返回。
- **同进程值可信。** 请求、描述符与结果按不可变约定借用；序列化与不可信输入校验属于进程与协议边界。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务入口：提供方注册表、启动与继续 API、生命周期事件 |
| [`src/manager.ts`](src/manager.ts) | 统一管理启动、消息准入、冷恢复、父子所有权、结算与释放 |
| [`src/activation.ts`](src/activation.ts) | 执行期记录、容量槽、子级锁与本地输出捕获 |
| [`src/continuation-messages.ts`](src/continuation-messages.ts) | 相邻 Agent 消息、返回指引与结算通知 |
| [`src/internal.ts`](src/internal.ts) | Host 专用 Queue 与 Steer 适配器，以及标准相邻 Agent 消息标记 |
| [`src/structured.ts`](src/structured.ts) | Activation 局部结构化捕获与保护 |
| [`src/types.ts`](src/types.ts) | 公开的请求、结果与提供方约定 |
| [`src/descriptor.ts`](src/descriptor.ts) | 版本化的 `subagent/descriptor` 会话事件词汇 |
| [`src/catalog.ts`](src/catalog.ts) | parent 自有的 `subagent/catalog` 事件与分块 host projection |
| [`src/child-agent.ts`](src/child-agent.ts) | 子级组装、委派策略、深度辅助函数 |
| [`src/list-children.ts`](src/list-children.ts) | 直接与递归的 parent 目录读取 |
| [`src/control.ts`](src/control.ts) | 浏览器控制请求校验与稳定失败分码 |
| [`src/control-types.ts`](src/control-types.ts) | client-safe 的目录行、控制面请求、回执与失败 |
| [`src/archive-admission.ts`](src/archive-admission.ts) | Workspace 注册表归档准入中的 `subagent` 族：运行中的子孙及其父级取消 |

### 提供方准备与结构化输出

服务在创建前校验请求能力。本地提供方只提供 `prepareContinuable()`：spawn 返回全新状态，fork 返回已完成轮次的初始内容。管理器在创建子级前捕获父级模型设置、委派权限和组合。外部提供方保留 `start()` 作为传输适配器，并保留各自的权限系统；统一管理器拥有已发布的执行。结构化工具、指令、校验与终止保护仅属于一次本地 activation，不作为恢复配置持久化。子代理只能在消费已接受的输入且所属后代释放后提交结构化结果。结果暂存后，在工具结果策略及外层 PTC 执行完成前拒绝继续输入；结果被拒绝后重新开放输入，提交成功后则保持关闭。后续冷恢复不带结构化 schema。

外部提供方为每次执行生成新的 `SubagentRun.id`，在运行时共享的 Session id 命名空间中跨所有父级和提供方保持唯一。与驻留 Agent、Session 或 activation 冲突时，启动以 `DUPLICATE_CHILD` 拒绝，并释放新的外部句柄，不替换已有执行。

### Activation 结算

管理器预留子级身份与容量，创建本地 Agent 或外部执行，并接受初始任务。本地 Agent 活动、待处理输入及所拥有的后代均结束后，管理器在最终 Session flush 后重新验证活动状态并关闭准入。本地与外部 activation 都在句柄清理、容量归还及结算通知结束后交付结果。宿主等待会汇合仍在推进的后代及其清理，包括失败的执行；空闲停放子树继续驻留，但不延迟宿主完成。关闭准入并释放句柄可防止迟到工作进入已释放的 Agent。父级投递在结算后发送通知；调用方投递由等待中的工作流收集。Headless 宿主交替等待 `agent.whenIdle()` 与 `waitForChildren(agent)`，直至没有子级工作，且父级在检查子级期间保持空闲、Session 序号不变，让完成通知可驱动父级生成最终答案。

本地 Agent 发生失败且后续没有成功提交 `turn/end` 时，会在所拥有的后代结束后以 `error` 结算。未认领的输入不会使该失败 activation 一直驻留。后续成功提交的轮次结束记录会取代实时失败，提供恢复后的结果。

本地创建成功后，无论结果交付给谁，都会向父 Session 追加 `subagent/catalog` 事实。外部创建仅在使用 `delivery: 'parent'` 时追加目录事实；调用方拥有的外部执行保留调用方自己的成员记录。外部条目以 `mode: 'external'` 标记没有本地 Session 的子级。目录仅在创建时记录一次成员关系，不携带执行状态。完整结果交给调用方或父级完成通知。投影排除继承事实。直接列表读取一个父级投影，因此已完成的本地工作流子级仍可被发现、打开或继续。Catalog 载荷 v0 记录本地模式，v1 还接受未知模式，v2 记录外部执行，读取器支持三版。历史迁移在 descriptor 不可用时根据可读子 header 追加 v1 `subagent/catalog`；本地创建保留 v0。其 `mode: 'unknown'` 投影让子会话保持可见，但不表示支持继续执行；已有完整条目仍具有权威性。

### 所有权与不变式

- **管理器拥有已接受工作**——未发布的失败会回滚；已发布句柄取消对应 activation，并等待子级优先释放。
- **注册受 effect 作用域约束**——移除提供方会阻止新启动，但绝不撤销已接受的运行。
- **Agent 消息权限基于确切相邻关系**——`sendMessage()` 要求确切在线 sender；每个 sender 都可以指定直接可继续 child，只有具备驻留可继续 Activation 的 sender 可以指定自己的直接 parent。
- **描述符仅进日志**——它是会话事件，不进入模型历史，并跨压缩（compaction）保留；写入器记录解析后的子级提供方、模型与推理强度，用于冷恢复。历史 one-shot 描述符仍可读取。
- **本 runtime 为子代理回答归档准入**（[接缝](../../workspace/workspace/README.zh.md)）——`workspace/session-activity` 把回合中的在线子代理子孙作为 `subagent` 族报告：按本包记录的持久化血缘查找（带 subagent 来源的 `parentSession`，任意深度，从不包括 fork），组合了 Session query 服务时经一次活会话 observation 从各 child 的描述符取名称，否则只报 id；`workspace/session-stop` 以父级原因逐个取消它们，一个拒绝取消的 child 只记日志，其兄弟仍会停止。父级自身的回合、它的任务以及已归档血缘的步骤门禁归 API Session Controller。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放问题与尚未决定的探索方向。它明确不具权威性——已交付的行为与限制以上文和包代码为准。

- **跨进程继续执行**——持久化邮箱与租约协议可让两个 harness 进程共享一个持久化存储。
- **可继续 ACP 子级**——需要持久化远程会话 id 与逐子级的继续执行能力声明。
- **host-user 投递**——未来的 host 适配器需要具体的经认证交互，该 seam 才能获得用户投递能力。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务入口：提供方注册表、启动与继续 API、生命周期事件 |
| [`src/manager.ts`](src/manager.ts) | 统一管理启动、消息准入、冷恢复、父子所有权、结算与释放 |
| [`src/activation.ts`](src/activation.ts) | 执行期记录、容量槽、子级锁与本地输出捕获 |
| [`src/continuation-messages.ts`](src/continuation-messages.ts) | 相邻 Agent 消息、返回指引与结算通知 |
| [`src/internal.ts`](src/internal.ts) | Host 专用 Queue 与 Steer 适配器，以及标准相邻 Agent 消息标记 |
| [`src/structured.ts`](src/structured.ts) | Activation 局部结构化捕获与保护 |
| [`src/types.ts`](src/types.ts) | 公开的请求、结果与提供方约定 |
| [`src/descriptor.ts`](src/descriptor.ts) | 版本化的 `subagent/descriptor` 会话事件词汇 |
| [`src/catalog.ts`](src/catalog.ts) | parent 自有的 `subagent/catalog` 事件与分块 host projection |
| [`src/child-agent.ts`](src/child-agent.ts) | 子级组装、委派策略、深度辅助函数 |
| [`src/list-children.ts`](src/list-children.ts) | 直接与递归的 parent 目录读取 |
| [`src/control.ts`](src/control.ts) | 浏览器控制请求校验与稳定失败分码 |
| [`src/control-types.ts`](src/control-types.ts) | client-safe 的目录行、控制面请求、回执与失败 |
| [`src/archive-admission.ts`](src/archive-admission.ts) | Workspace 注册表归档准入中的 `subagent` 族：运行中的子孙及其父级取消 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从共享 seam 逐步进入后端、面向模型的工具与设计决策。

- [Subagent 子系统](../../../docs/subsystems/subagent.zh.md)——服务约定、提供方约定与终态结果语义。
- [历史Subagent 能力 seam](../../../.agents/notes/archived/feature/2026-06-21-subagent-capability-seam.md)——委派能力家族的设计记录。
- [可继续的 subagent](../../../.agents/notes/implemented/feature/2026-07-28-continuable-subagent-conversations.zh.md)——接受后续轮次的持久子级。
- [进程内 spawn 后端](../subagent-spawn-in-process/README.zh.md)——最容易组合的提供方。
- [Auto review](../../experimental/auto-review/README.zh.md)——只有进程内 DSH 子级继承的当前会话授权模式。
- [进程外 ACP 后端](../subagent-acp/README.zh.md)——经 Agent Client Protocol 拥有自有运行时的子级。
- [DeepSeek 输入转换](../../llm/llm-deepseek/README.zh.md#model-experience)——已保存结算通知的提供方回放规则。
- [tool-subagent-control README](../tool-subagent-control/README.zh.md)——后续消息、中断与列举面。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-subagent'
- name: '@deepseek-ai/dsh-subagent-spawn-in-process'
- name: '@deepseek-ai/dsh-tool-subagent'
  config:
    provider: spawn
    toolName: subagent
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务入口：提供方注册表、启动与继续 API、生命周期事件 |
| [`src/manager.ts`](src/manager.ts) | 统一管理启动、消息准入、冷恢复、父子所有权、结算与释放 |
| [`src/activation.ts`](src/activation.ts) | 执行期记录、容量槽、子级锁与本地输出捕获 |
| [`src/continuation-messages.ts`](src/continuation-messages.ts) | 相邻 Agent 消息、返回指引与结算通知 |
| [`src/internal.ts`](src/internal.ts) | Host 专用 Queue 与 Steer 适配器，以及标准相邻 Agent 消息标记 |
| [`src/structured.ts`](src/structured.ts) | Activation 局部结构化捕获与保护 |
| [`src/types.ts`](src/types.ts) | 公开的请求、结果与提供方约定 |
| [`src/descriptor.ts`](src/descriptor.ts) | 版本化的 `subagent/descriptor` 会话事件词汇 |
| [`src/catalog.ts`](src/catalog.ts) | parent 自有的 `subagent/catalog` 事件与分块 host projection |
| [`src/child-agent.ts`](src/child-agent.ts) | 子级组装、委派策略、深度辅助函数 |
| [`src/list-children.ts`](src/list-children.ts) | 直接与递归的 parent 目录读取 |
| [`src/control.ts`](src/control.ts) | 浏览器控制请求校验与稳定失败分码 |
| [`src/control-types.ts`](src/control-types.ts) | client-safe 的目录行、控制面请求、回执与失败 |
| [`src/archive-admission.ts`](src/archive-admission.ts) | Workspace 注册表归档准入中的 `subagent` 族：运行中的子孙及其父级取消 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-subagent
