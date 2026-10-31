---
title: "@deepseek-ai/dsh-session-format-v1-to-v2"
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

`dsh-session-format-v1-to-v2` 通过一个有状态事件 Stage，把已发布 v1 Session 转换为已发布 v2 事件模型。它会消费顶层 `assistant/chunk` 事件，把精确的带时间流嵌入匹配的 `assistant/message`，并在失败、重试、取消或 stream error attempt 已到达 settlement、但没有产生 surface message 时记录 `assistant/attempt`。该迁移边会密集重映射存活事件和每个已声明的同 Session 序号引用；v2 codec 则让每行只存一个事件，并从带标记的 `session/end-seed` 事件推导继承切点。

---

## ⚡ 功能

### 限制

- **封闭的第一方源清单**——未知 v1 事件会使迁移失败，包括带有 `ignorable: true` 的事件。
- **线性重映射状态**——流式处理不保留完整 v1 事件数组，但最终 v2 事件数组和旧到新序号映射仍为 O(事件数)。
- **不负责发布或兼容回退**——持久化拥有排他 successor 发布，保留的 v1 generation 不是自动 downgrade 或 restore 输入。

---

## 📊 指标

### 历史还原

#### 模型看到什么

成功的 Assistant message 会保留从同一 v1 stream 组装出的 content、provider、model、usage 与 replay state。失败或放弃的 attempt 会通过 `assistant/attempt` 保留为持久诊断事实，但不会进入 `deriveMessages()`。

#### Token 影响

迁移不会添加模型可见内容。它会保留派生 message history，只从当前逻辑事件序列中移除顶层 chunk 信封。

#### KV Cache 影响

还原后的模型 message 序列保持不变，因此迁移本身不会改变请求前缀的缓存身份。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

增量迁移边会保留一个尚未结算的 Assistant attempt、输出位置取决于该 attempt 的事件，以及密集的旧序号到新序号映射。它按源顺序发出已结算的存活事件，并且只重写冻结事件清单声明的引用字段。Released-current 校验会拒绝转换无法保留的任何关系。

| 文件 | 职责 |
|---|---|
| [`src/migration.ts`](src/migration.ts) | Attempt 分组、settlement 替换、密集序号映射与引用重写 |
| [`src/codec.ts`](src/codec.ts) | 已发布 v2 header、每行一个事件的编码、source-event 范围与可恢复前缀解码 |
| [`src/validation.ts`](src/validation.ts) | v2 物理 envelope／cut 校验，以及 released-current 事件准入与关系校验 |
| [`src/dispositions.ts`](src/dispositions.ts) | 冻结的已发布 v2 事件与 payload 成员清单 |

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [已发布 v0 到 v1 迁移边](../session-format-v0-to-v1/README.zh.md)——本包复用的源编解码器与冻结历史词表。
- [静态目录](../session-format-catalog/README.zh.md)——构建拥有的编解码器与迁移顺序。
- [Session 持久化子系统](../../../docs/subsystems/persistence.zh.md)——不可变 generation 选择与发布。
- [嵌入式 Assistant stream 决策](../../../.agents/notes/implemented/architecture/2026-09-01-v2-embedded-assistant-streams.zh.md)——理由、替代方案与后果。

---

## 🚀 快速开始

### 何时使用

持久化通过 `dsh-session-format-catalog` 获取该迁移边；功能组合不会挂载它。只有在装配或测试静态已发布格式目录，或检查精确的 v1 到 v2 转换时，才直接导入本包。

### 入口

```text
const decoder = releasedV1SessionFormatCodec.createDecoder(physicalHeader, 'strict')
for (const row of physicalRows) decoder.decodeRow(row, migrationContext)
const stage = ses

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-format-v1-to-v2
