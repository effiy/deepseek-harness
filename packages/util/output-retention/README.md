---
title: "@deepseek-ai/dsh-output-retention"
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

使用 `dsh-output-retention` 限制工具返回给模型的项或文本量，并报告省略了什么。`ItemRetainer` 保留有序的头部窗口，并可报告精确的省略项数；`TextRetainer` 保留 head、tail 或 head-and-tail 字节窗口，且不会返回因切割而无效的 UTF-8。`formatRetentionNotice` 添加一致的省略子句，各工具则提供自己的恢复指引。`truncateWithoutSplittingSurrogatePair` 按字符预算截断预览时，不会在切口留下孤立的高位代理项。分组、行号、spill 文件与提供方错误仍归工具负责；消费方直接导入本库，而不通过 `cordis.yml` 加载。

---

## ⚡ 功能

### 限制

这些限制说明 retainer 刻意不覆盖什么。它们是当前包约束，不是任务积压。

- **项保留只支持 `head`**——tail、head/tail、分页、分组与提供方完整性语义仍归工具所有。
- **文本保留面向字节**——`TextRetainer` 以字节计数；字符预算的头部截断走 `truncateWithoutSplittingSurrogatePair`，`read` 分页等行窗口仍需独立渲染器；切割可能丢弃部分 UTF-8 边界字节，以保持返回文本有效。

---

## 📊 指标

通过渲染保留内容与省略元数据的保留消费方间接影响模型。

#### KV Cache 影响

不会直接导致失效；请求前缀的任何变更由保留消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本库建立在一个分离之上：它负责「保留了什么、省略了什么」这个机制问题；业务含义全部归工具包所有。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `ItemRetainer`、`TextRetainer`、`describeOmitted`、`formatRetentionNotice` 与 `truncateWithoutSplittingSurrogatePair` |

### 两个 retainer，两种资源模型

`ItemRetainer` 限制有序逻辑单元，只保留前 `maxItems` 个；调用方持续送入每个已观察单元，因此省略计数是精确的。`TextRetainer` 用同一个前缀/后缀累加器限制字节：`head` 只留前缀，`tail` 只留后缀，`headTail` 两者都留；累加器在内存中至多持有 `headBytes + tailBytes + 一个分片`，因此大流不会无界累积。

### 预算事实如何保持诚实

`push()` 返回 `kept`（该单元或分片是否完整保留）与 `truncated`（是否已丢弃任何内容）。`finish()` 按实际返回的字节报告省略，因此丢弃部分码点字节的 UTF-8 边界修剪也会被计入——仅按预算推导的通知会高估保留文本。`describeOmitted` 只为 `exact` 打印计数；`unknown` 不打印计数，因为调用方没有提供。

### read 渲染的排除

`read` 的 `offset`/`limit` 分页是行窗口渲染器，对所选窗口有自己的字节上限；单个 `Omitted` 值无法表示该窗口两侧，因此它不属于本库。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `ItemRetainer`、`TextRetainer`、`describeOmitted`、`formatRetentionNotice` 与 `truncateWithoutSplittingSurrogatePair` |

---

## 🔗 资源

当你需要消费方或库背后的边界决策时，阅读以下页面。

- [spill 策略](../../spill/spill-policy/README.zh.md)——组合 `TextRetainer`，围绕 spill 文件通知构建有界预览。
- [spill 子系统](../../../docs/subsystems/spill.zh.md)——本库预览机制所服务的 spill 词汇。
- [文件搜索工具](../../fs/tool-fs-search/README.zh.md)——为 spill 收集完整结果的 `ItemRetainer` 消费方。

---

## 🚀 快速开始

```ts
import { ItemRetainer } from '@deepseek-ai/dsh-output-retention'

declare const globMaxResults: number
declare const candidates: AsyncIterable<{ path: string }>
const retainer = new ItemRetainer<{ path: string }>({ kind: 'head', maxItems: globMaxResults })
for await (const entry of candidates) {
  retainer.push(entry)          // keep draining past the cap for an exact count
}
const { items, truncated, omitted } = retainer.finish()
```

```ts
import { TextRetainer } from '@deepseek-ai/dsh-output-retention'

const out = new TextRetainer({ kind: 'headTail', headBytes: headCap, tailBytes: tailCap })
child.stdout.on('data', (chunk: Buffer) => { out.push(chunk) })
const { text, omittedBytes } = out.finish()
```

限制项列表



`push()` 逐项报告该项是否被保留，`finish()` 返回保留的项与 `omitted`——当调用方持续送入每个已观察单元时，这是一个精确计数。搜索工具可以收集完整结果集用于 spill 文件，同时只为模型保留第一页。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-output-retention
