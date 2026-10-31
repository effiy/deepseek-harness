---
title: "@deepseek-ai/dsh-session-format-catalog"
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

`dsh-session-format-catalog` 为持久化提供一个确定性的 Session 格式读取器，且无需查询已挂载插件。它装配从最早受支持格式到[当前写入格式](../../../docs/session-format-status.zh.md)的编解码器与相邻迁移边，在模块初始化时校验完整且无缺口的迁移链，并通过 `sessionFormatCatalog` 暴露物理分派、仅 header 分类、单遍行还原和当前格式逐记录编码。

---

## ⚡ 功能

### 适用场景

当持久化与测试支持读取方需要在任何功能插件挂载前取得完整第一方已发布格式清单时，导入本库。功能组合不会注册或重排其条目。

### 限制

- **仅包含第一方构建清单**——尚不支持外部迁移所有权与分发。
- **生成顺序封闭**——运行时插件注册无法补充缺失的历史迁移边。

---

## 📊 指标

### 目录分派

#### 模型看到什么

没有直接内容。该目录只还原由请求重建逻辑消费的 `SessionEvent` 历史。

#### Token 影响

不直接产生 token。

#### KV Cache 影响

没有直接影响；还原后的历史在其消费方中决定缓存身份。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

[`src/generated.ts`](src/generated.ts) 是编解码器与迁移边顺序的静态所有者。[`src/current.ts`](src/current.ts) 把最终标头、事件信封、消息、表面、种子和当前请求标头校验委托给已安装的 Session 语义。底层构造函数会在开始读取任何 Session 之前拒绝重复编解码器、重复迁移边、缺口，以及超过当前版本的条目。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [迁移机制](../session-format/README.zh.md)——目录构造与分派行为。
- [已发布 v0 到 v1 迁移边](../session-format-v0-to-v1/README.zh.md)——编解码器与校验器所有权。
- [已发布 v1 到 v2 迁移边](../session-format-v1-to-v2/README.zh.md)——Assistant 流嵌入与基数变化引用重映射。
- [已发布 V2 到 V3 规范](../session-format-v2-to-v3/README.zh.md#v2-to-v3-specification)——转换、保留与拒绝。
- [V3 到 V4 规范](../session-format-v3-to-v4/README.zh.md#v3-to-v4-specification)——转换、引用重映射与 delivery generation 校验。
- [JSONL 持久化](../session-persistence-jsonl/README.zh.md)——不可变 generation 命名与排他发布。

---

## 🚀 快速开始

```ts
const descriptor = sessionFormatCatalog.readHeader(physicalHeader)
const catalog = createSessionFormatCatalogWithChildren(childFacts)
const restore = catalog.createRestore(physicalHeader, { recovery: 'recoverable', validation: 'transformed' })
for (const row of physicalRows) restore.decodeRow(row)
const current = restore.finish()
const headerRecord = sessionFormatCatalog.encodeCurrentHeader(current.header, current.inheritedEventCount)
const eventRecords = current.events.map(sessionFormatCatalog.encodeCurrentEvent)
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-format-catalog
