---
title: "@deepseek-ai/dsh-session-format-v0-to-v1"
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

本包逐个物理行解码已发布的 v0 会话 JSONL，并生成共享布局的 v1 格式，以还原历史会话。除把版本从 0 改为 1 外，它会保留经过校验的标头与事件，并仅应用 v0 持久化接受的有限旧格式规范化。畸形或不支持的历史记录会在当前还原器运行前使迁移失败，同时保留源文件以便恢复。该迁移只接受冻结的第一方事件清单，且不发布或选择后续格式迁移。

---

## ⚡ 功能

### 适用场景

持久化通过 `dsh-session-format-catalog` 获取该迁移边；功能组合不会挂载它。只有在装配或测试静态已发布格式目录时，才直接导入本包。

### 限制

- **封闭的第一方清单**——按照当前 Alpha 策略，未知的外部插件事件会使迁移失败。
- **单个相邻迁移边**——本包不执行发布，也不选择后续迁移。

---

## 📊 指标

### 历史还原

#### 模型看到什么

没有直接内容。还原后，`deriveMessages()` 会看到在 v1 下保持不变的规范已发布 v0 事件；有限历史结构会通过规定的当前包装层产生相同的模型可见内容。

#### Token 影响

不直接产生 token。

#### KV Cache 影响

对规范 v0 历史没有直接影响。有限 normalizer 会在生成当前包装层与确定性标识时保留模型可见内容。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

物理 codec 会以行为原子单位校验每个打包行，以紧凑 run 发出它，且绝不修改已解析输入。可恢复解码会丢弃完整的故障行并保留此前前缀，除非后续成功解码的 `turn/end` 证明故障区域已经提交。增量 normalizer 只保留 message、retry 与未结束的压缩 identity；catalog 会在最终当前产物上执行完整关系校验。

| 文件 | 职责 |
|---|---|
| [`src/codec.ts`](src/codec.ts) | 冻结的 v0/v1 物理标头、打包行与来源序号范围 |
| [`src/dispositions.ts`](src/dispositions.ts) | 已发布 v0 事件与 payload 成员清单 |
| [`src/payload-validation.ts`](src/payload-validation.ts) | 每种已发布 v0/v1 事件类型的冻结嵌套 payload 语义 |
| [`src/relationships.ts`](src/relationships.ts) | 冻结的跨事件配对：轮次、步骤、工具开始与结果、重试、压缩、标题 |
| [`src/migration.ts`](src/migration.ts) | 恒等迁移边与旧格式规范化 |
| [`src/validation.ts`](src/validation.ts) | 精确的源与目标校验 |

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [迁移机制](../session-format/README.zh.md)——纯迁移链与编解码约定。
- [静态目录](../session-format-catalog/README.zh.md)——由构建负责的装配。
- [会话子系统](../../../docs/subsystems/session.zh.md)——当前逻辑会话语义。

---

## 🚀 快速开始

```ts
const decoder = releasedV0SessionFormatCodec.createDecoder(physicalHeader, 'recoverable')
for (const row of physicalRows) decoder.decodeRow(row, migrationContext)
const inheritedEventCount = decoder.finish(migrationContext)
const stage = sessionFormatV0ToV1.createStage(stageInput)
stage.transformEvent(event, migrationContext)
const targetInheritedEventCount = stage.finish(migrationContext)
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-format-v0-to-v1
