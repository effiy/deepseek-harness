---
title: "@deepseek-ai/dsh-session-persistence"
tags: []
category: "session"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

本包让应用通过后端无关的 API 持久存储并恢复会话事件日志。读者可以创建、打开、检查、列出、追加、读取、刷新和关闭已存储会话，同时保持连续且仅追加的历史记录。只有完成 flush 才构成持久性屏障；读取方不会收到撕裂尾部或无效记录，并且每个后端实例内每个会话只允许一个写入方。若希望每个会话使用一份压缩日志，可选用随产品交付的 [JSONL 后端](../session-persistence-jsonl/README.zh.md)；也可以实现具备相同可观察保证的其他后端。

---

## ⚡ 功能

### 限制

这些限制界定 seam 保证的终点。它们是当前包约束，不是待办事项。

- **seam 只保证单个后端实例内的写所有权**——跨进程排他由具体提供方负责。随产品交付的 JSONL 提供方通过内核锁在不同实例和进程之间提供租约；其他提供方必须记录等效保证，或要求部署方阻止并发写入。
- **在有活跃会话时重载后端插件会使其写入器明确报错**——重载后的后端无法服务旧实例签发的句柄；写入会持续失败直到会话重启，没有任何机制静默重新接管日志。
- **只有通过句柄获取的会话才会持久化**——仅靠 `ctx.sessions.create` + `session/flush` 不存储任何内容；agent-loop 是生产环境的获取点，测试通过 `create`/`append`/`close` 写入初始存储数据。
- **无删除或保留接口**——剪枝已存储会话属于带外后端维护。
- **`list()` 无分页且无过滤**——它返回每个已存储会话的快照；适合本地存储，大规模时无索引。
- **合成 closer 是唯一崩溃方案**——恢复通过写句柄追加 `interruptedTurnClosers`；没有继续中断轮次而不先关闭它的部分轮次恢复。

---

## 📊 指标

### 恢复的对话历史

#### 模型看到什么

seam 不添加提示词或 schema。恢复会将已存储的表层事件还原为消息历史；已存储请求 header 重建较早调用，新 loop 则为下一次请求组合当前系统提示词、工具与会话前缀。崩溃修复将没有持久调用的 assistant 请求标记为 `TOOL_NOT_STARTED`；有持久调用但无结果时变为 `TOOL_OUTCOME_UNKNOWN`，其文本允许模型重试只读或幂等工作，但要求验证副作用或询问用户，而不是盲目重试。

#### Token 影响

普通持久化期间为零 token。恢复后会重新计入保留历史的 token 用量，并照常计入当前请求 envelope 的 token 用量；每个已修复调用都会增加一段以引用形式保留的错误文本。

#### KV Cache 影响

持久化不修改当前请求前缀。只有当重建历史、当前 envelope 与模型路由匹配时，恢复 loop 才能重用提供方缓存；崩溃修复结果仅追加，不重写较早历史。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节说明 seam 如何实现持久存储以及后端如何接入；可观察约定见[使用本包](#use-this-package)与生成的 [Cordis API](../../../docs/subsystems/persistence.zh.md#cordis-surface)。

### 设计理念

本包是 seam，而不是后端框架：它只导出抽象 `SessionPersistence` 服务、`SessionHandle` 约定、消费方捕获的稳定错误类、纯函数的存储记录校验辅助（`storage-contract`）以及带品牌类型的修订值——再无其他。每个提供方拥有自己完整的存储运行时（句柄类、修改排序、单写者记账、实时事件路由、拆卸），`tests/` 下的两套共享测试套件——`runPersistenceContract` 与 `runLiveWritePathContract`——固定所有提供方都必须一致的可观察行为。有意为之的后果：各提供方在存储恰好相似之处可以彼此相像，但没有任何实现机制跨越包边界。

### 每个后端必须遵守的不变量

- **仅追加，连续 `seq`。** 已提交事件绝不重写；`append` 的第一个 `seq` 必须等于已存储 next-seq，缺口会被拒绝。
- **撕裂的物理尾部绝不到达读取方。** 它属于一次从未完成的 append；写路径在第一次新 append 之前将其持久截断。
- **无损 JSON 数据。** 批次与 header 经过共享的单遍校验并快照边界（`materializeAppendBatch`/`materializeCreateHeader`）；无法序列化的载荷在调用处被拒绝。
- **持久性。** `append` 尽力而为地持久化；`flush`——逐句柄或服务级——是承诺存储并同时把空会话实体化的屏障。
- **遇到未知或无效格式时拒绝读取。** `validateStoredEvents` 拒绝未知事件词汇与已废弃的预发布形态；`assertVersion` 拒绝外来格式版本。
- **每个后端实例单写者。** 提供方的进程内认领在 `create`/`open('write')` 时取得，在句柄关闭时释放。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `SessionPersistence` 服务与重新导出的 seam 词汇 |
| [`src/handle.ts`](src/handle.ts) | `SessionHandle` 约定：read/append/flush/close 语义与新鲜度规则 |
| [`src/storage-contract.ts`](src/storage-contract.ts) | 共享校验：版本门禁、未知事件词汇拒绝、批次实体化、连续性 |
| [`src/errors.ts`](src/errors.ts) | 稳定的句柄/所有权失败与格式拒绝 |
| [`src/revision.ts`](src/revision.ts) | 带品牌类型的不透明修订值 token |

### 写入路径概览

写入器会话的每个 `session/event` 都复制进该句柄的内部缓冲。第一个待处理事件开启固定批处理窗口；后续事件加入但不重置截止时间。窗口到期后经由句柄的修改链排空待处理前缀；排空期间接纳的事件按顺序合并进下一个链上的批次。`session/flush` 取消等待并排空至完全停稳，随后运行 `handle.flush()`，因此 loop 在下一轮次前把它用作排序与错误观察检查点。失败的后台排空保留其事件并暂停自动计时器；显式 flush、写入器 close 或后端拆卸会立即重试，并在再次失败时明确返回拒绝。构造 seed 事件绝不发出 `session/event`，因此发布前通过句柄追加的 seed 绝不会被重新入队。

### 存储记录校验

seam 的共享辅助函数校验由 `SESSION_FORMAT_VERSION` 标识的当前逻辑记录，append 只写当前格式（[理由](../../../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.zh.md)）。历史解码与不可变后继发布属于各提供方内部，并在其返回句柄前完成。每个后端都在句柄读取与写 open 预热时运行 `storage-contract` 校验，把未知事件类型作为 `SessionFormatUnsupportedError` 拒绝，把格式错误的当前记录作为 `SessionPersistenceCorruptionError` 拒绝，并在后端为每个会话保留一份产物时附上原始日志的 `SessionLocation`。

</details>
-----

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `SessionPersistence` 服务与重新导出的 seam 词汇 |
| [`src/handle.ts`](src/handle.ts) | `SessionHandle` 约定：read/append/flush/close 语义与新鲜度规则 |
| [`src/storage-contract.ts`](src/storage-contract.ts) | 共享校验：版本门禁、未知事件词汇拒绝、批次实体化、连续性 |
| [`src/errors.ts`](src/errors.ts) | 稳定的句柄/所有权失败与格式拒绝 |
| [`src/revision.ts`](src/revision.ts) | 带品牌类型的不透明修订值 token |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从共享持久性模型逐步进入随产品交付的后端与决策证据。

- [会话持久化子系统](../../../docs/subsystems/persistence.zh.md)——完整服务约定、句柄语义、flush 检查点、崩溃恢复与生成的 Cordis API。
- [基于句柄的持久化 Agent Note](../../../.agents/notes/implemented/architecture/2026-08-27-handle-based-session-persistence.zh.md)——seam 设计及其所有权模型。
- [JSONL 持久化后端](../session-persistence-jsonl/README.zh.md)——随产品交付、按会话存储文件的后端。
- [会话检查点策略](../session-checkpoint-policy/README.zh.md)——在语义边界上经由 `session/flush` 刷新的插件。
- [会话包映射](../README.zh.md)——相邻的持久化、投影、标题与遥测包。

---

## 🚀 快速开始

挂载一个持久化后端即可让会话持久化。后端把自己注册为 `ctx.sessionPersistence`，并把每个已发布会话的实时事件路由进该会话的活跃写句柄；agent-loop——会话在生产环境中的发布点——在发布之前获取每个会话的写句柄，因此组合中的其他部分不变。

### 选择后端

seam 随产品交付 [JSONL](../session-persistence-jsonl/README.zh.md) 后端。它为每个会话存储一份仅追加的 `.jsonl.zstd` 日志。第三方后端可以直接实现该服务；必须遵守的[后端约定](#understand-the-implementation

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-persistence
