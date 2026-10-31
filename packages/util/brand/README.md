---
title: "@deepseek-ai/dsh-brand"
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

`dsh-brand` 让结构相同的字符串或数字在类型层面不可互换：`SessionId` 无法传给期望 `ToolCallId` 的位置，事件序号也无法传给需要日志偏移量的位置。`brandString<T>()` 与 `brandNumber<T>()` 在不持有共享运行时状态的情况下应用名义品牌，让所属包可以定义领域类型，而无需导入不相关的能力。

---

## ⚡ 功能

### 适用场景

为跨包边界且可能被混淆的值添加品牌——`dsh-llm` 中的 `ToolCallId`、`dsh-session` 中由 agent（智能体）和会话共享的 `SessionId`、`dsh-jobs` 中的 `JobId`，以及 `dsh-session` 中的 `SessionSeq` 与 `SessionLogOffset`。保持局部或无法混淆的值不需要这种抽象。

---

## 📊 指标

「待补充」

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

该包定义两个交叉类型：`string & { readonly [BRAND]: B }` 与 `number & { readonly [BRAND]: B }`，其中 `BRAND` 是模块私有的 `unique symbol`。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 品牌化字符串与数字类型及其无状态构造函数 |

### 值为何可移植

私有 symbol 在运行时不存在：TypeScript 会将其擦除，因此品牌化值没有标签或 prototype。`brandString()` 与 `brandNumber()` 都原样返回输入。因此，彼此独立安装的副本无需共享注册表或 constructor identity，也会生成可互换的值。

### 为何保持无依赖

把这些 helper 放在独立包中，意味着 `dsh-jobs` 可以为 `JobId` 添加品牌，而无需导入不相关的能力包；每个能力仍然拥有其具体 id 的含义与校验。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 品牌化字符串与数字类型及其无状态构造函数 |

---

## 🔗 资源

当你需要这些原语所品牌化的值或围绕它们的类型约定时，阅读以下页面。

- [核心子系统](../../../docs/subsystems/core.zh.md)——共享 `SessionId` 品牌与类型规则的记录位置。
- [LSP 子系统](../../../docs/subsystems/lsp.zh.md)——构建在本原语之上的品牌化提供方 id `LspProviderId`。
- [jobs 包](../../jobs/jobs/README.zh.md)——由 jobs 能力拥有的 `JobId` 品牌。

---

## 🚀 快速开始

```ts
import { brandString, type Branded } from '@deepseek-ai/dsh-brand'

export type SessionId = Branded<'SessionId'>

const sessionId = brandString<SessionId>('session-1')
```

```ts
import { brandNumber, type BrandedNumber } from '@deepseek-ai/dsh-brand'

export type SessionSeq = BrandedNumber<'SessionSeq'>

const seq = brandNumber<SessionSeq>(7)
```

为字符串添加品牌

在所属包中声明品牌化类型，并在该包准入字符串的位置应用品牌：



`brandString()` 只改变静态类型，不执行运行时校验。所属类型若有领域文法，应在调用前完成校验。添加品牌后，该 id 在比较、日志记录、JSON 序列化和协议传输中仍表现为普通字符串。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-brand
