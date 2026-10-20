---
title: "@deepseek-ai/dsh-session-format"
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

`dsh-session-format` 让持久化代码可以直接还原当前会话，或在只消费一次物理行的同时组合唯一的相邻迁移序列。一次还原会让调用方拥有的已解析值流经有状态 Stage，不复制或冻结中间产物。物理分帧、压缩、不可变 generation 命名、排他发布和 Cordis 生命周期行为不属于本库。

---

## ⚡ 功能

### 适用场景

当持久化或格式目录代码需要分类物理会话 header、还原当前逻辑值或组合已发布相邻迁移时，使用本库。它不是 Cordis 插件，也没有 profile 挂载行。

### 限制

- **最终当前历史仍常驻内存**——流式处理只保留有界中间状态，但返回的当前事件数组和必需的序号重映射表仍为 O(事件数)。
- **仅支持相邻整数版本**——本库不暴露 span、稳定事件身份或通用引用重写代数。

---

## 📊 指标

### 会话还原

#### 模型看到什么

没有直接内容。消费方通过 `deriveMessages()` 从经过校验的当前产物重建模型历史。

#### Token 影响

不直接产生 token。

#### KV Cache 影响

没有直接影响。迁移若改变当前历史，可能改变由请求重建逻辑拥有的缓存身份。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

迁移链在构造时校验唯一且无缺口的顺序。源切点可以在 EOF 前保持未知；依赖头部切点的 Stage 拒绝缺失值，而基于标记的 Stage 从已发出的事件推导切点。每个 Stage 在完成时返回精确的目标切点，且必须与预声明切点一致。Catalog 把一个行 decoder 与有状态的相邻事件 transformer 组合起来，只保留其有界状态与最终当前事件，并在 `finish()` 时执行目标校验；只有调用方决定是否发布该结果以及如何发布。

| 文件 | 职责 |
|---|---|
| [`src/chain.ts`](src/chain.ts) | 相邻计划构造与当前格式绕过 |
| [`src/catalog.ts`](src/catalog.ts) | 物理版本分派与标头分类 |
| [`src/json.ts`](src/json.ts) | 分离的无损 JSON 快照与通用坐标校验 |
| [`src/filename.ts`](src/filename.ts) | 持久化、导出与 fixture（测试前置数据）共用的规范 `session[.vN].jsonl` 文件名 |

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [已发布 v0 到 v1 迁移边](../session-format-v0-to-v1/README.zh.md)——冻结的历史解码与恒等转换。
- [静态目录](../session-format-catalog/README.zh.md)——第一方编解码器与迁移装配。
- [JSONL 持久化](../session-persistence-jsonl/README.zh.md)——持久化分帧与代际发布。

---

## 🚀 快速开始

```ts
const catalog = createSessionFormatCatalog({ currentVersion, codecs, currentEncoder, migrations, restoreCurrent, restoreTransformedCurrent, restoreCurrentHeader })
const descriptor = catalog.readHeader(physicalHeader)
const restore = catalog.createRestore(physicalHeader, { recovery: 'recoverable', validation: 'transformed' })
for (const row of physicalRows) restore.decodeRow(row)
const current = restore.finish()
const headerRecord = catalog.encodeCurrentHeader(current.header, current.inheritedEventCount)
const eventRecords = current.events.map(catalog.encodeCurrentEvent)
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-format
