---
title: "@deepseek-ai/dsh-chunked-list"
tags: []
category: "util"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-chunked-list` 让调用方追加值并保留早期列表版本，无需复制整个集合。调用方可以按插入顺序迭代所有值，并使用自己的值 schema 校验 JSON 检查点。subagent 目录用它保存不可变的 projection state。

---

## ⚡ 功能

### 限制

- **仅追加访问**——需要删除或随机访问的调用方应使用其他集合。
- **递归检查点**——JSON 序列化与 schema 校验仍受运行时嵌套深度限制。所存的值本身必须支持调用方的序列化格式。

---

## 📊 指标

无，因为此集合不注册任何面向模型的内容。

#### KV Cache 影响

本包没有内容进入模型请求，因此不影响提供方缓存复用。

## 已知限制与延后工作

---

## 🏛️ 设计

<details>
<summary>实现内部机制——点击展开</summary>

最新的分片最多存储 64 个值。追加最多复制该分片并共享较旧的节点，工作量为有界 O(1)。容量控制存储布局，不限制列表总长度。迭代以 O(N) 时间访问全部 N 个值，并使用 O(N / 64) 临时空间按从旧到新的顺序访问各分片。追加换片与递归 Zod 校验共用一个容量常量。

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 持久化列表操作与检查点校验 |
| [`tests/chunked-list.spec.ts`](tests/chunked-list.spec.ts) | 版本隔离、顺序、结构共享与检查点接受条件 |

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [工具包映射](../README.zh.md)——共享原语。
- [Subagent 目录决策](../../../.agents/notes/implemented/architecture/2026-09-01-parent-owned-subagent-catalog.zh.md)——projection state 使用分片的原因。

---

## 🚀 快速开始

```ts
import { appendChunkedList, iterateChunkedList } from '@deepseek-ai/dsh-chunked-list'

const first = appendChunkedList(undefined, 'first')
const second = appendChunkedList(first, 'second')
console.log([...iterateChunkedList(second)])
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-chunked-list
