---
title: "@deepseek-ai/dsh-util-values"
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

调用方可以校验无损 JSON、读取流式参数、创建分离的 JSON 快照、冻结待发布值、比较 JSON 兼容数据，或终止不可达分支，而无需导入某个能力包。每次流式调用使用独立的 `PartialArguments` 读器；`PartialArguments.EMPTY` 是不含字段的共用封存视图。

---

## ⚡ 功能

### 限制

- **`deepEqualJson` 假定输入兼容 JSON**——它不是通用对象比较器，不为 prototype、symbol、accessor、循环、map 或 set 定义语义。
- **`deepFreeze` 沿可枚举字符串键遍历子项**——它不会把任意宿主对象变成不可变数据，并会刻意跳过活跃 `AbortSignal` 实例。
- **`WeakMapWithValues` 要求显式清理且 value 唯一**——value 会保持强引用，直到 owner 删除其 key 或清空集合；同一 value 不得由多个 key 共享。

---

## 📊 指标

「待补充」

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

JSON 校验器使用显式工作栈，并只跟踪当前祖先链，因此深层嵌套值不会消耗 JavaScript 调用栈，重复但无循环的引用仍然有效。内建数组与普通对象通过当前引擎的原生构造器文本表示进行跨 JavaScript realm 识别。快照写入使用自有数据属性，包括 `__proto__` 等名称。值操作的结果只取决于传入参数；`WeakMapWithValues` 仅保存实例自有的关联。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | JSON 值类型、校验与快照遍历、结构相等、深度冻结、弱键/强值关联和穷尽联合类型失败 |
| [`src/partial-json.ts`](src/partial-json.ts) | 懒扫描顶层参数，并检测已读取答案的变化 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | JSON 值类型、校验与快照遍历、结构相等、深度冻结、弱键/强值关联和穷尽联合类型失败 |
| [`src/partial-json.ts`](src/partial-json.ts) | 懒扫描顶层参数，并检测已读取答案的变化 |

---

## 🔗 资源

- [工具包映射](../README.zh.md)——相邻的无状态 helper。
- [会话子系统](../../../docs/subsystems/session.zh.md)——要求无损 JSON 的持久事件。
- [工具子系统](../../../docs/subsystems/tools.zh.md)——构建于 `JsonValue` 之上的 schema 校验与规范工具结果。

-----

## 已知限制与延期工作

---

## 🚀 快速开始

```ts
import { isJsonValue, snapshotJsonValue, type JsonValue } from '@deepseek-ai/dsh-util-values'

declare const input: unknown

if (!isJsonValue(input)) throw new TypeError('expected lossless JSON')
const snapshot = snapshotJsonValue(input) as JsonValue
```

校验 JSON 数据或创建快照

需要 predicate 时使用 `isJsonValue()`，还需要分离副本时使用 `snapshotJsonValue()`。两者只接受无损 JSON 根值：`null`、布尔值、除负零外的有限数字、字符串、稠密的内建数组，以及只含可枚举字符串键的普通或 null-prototype 记录。循环、稀疏数组、自有 symbol 属性或自有不可枚举属性、函数和 class 实例都会被拒绝。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-values
