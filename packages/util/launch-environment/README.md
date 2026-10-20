---
title: "@deepseek-ai/dsh-launch-environment"
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

使用 `@deepseek-ai/dsh-launch-environment` 解析启动时的环境值，无需信任压平的 `process.env`。它会冻结继承的进程值、调用目录的 `.env` 和 Harness 主目录的 `.env`，再按固定可信顺序返回胜出的值及其来源。调用方可以在敏感查找中排除某些层；无论之后顺序如何变化，被省略的层都不可达。快照不可变，但每一层仍会被复制到 `process.env`，因此它不隔离子进程。请把它作为库导入；不能从 `cordis.yml` 挂载它。

---

## ⚡ 功能

### 限制

这些限制说明快照何时不是安全边界。它们是当前包约束，不是任务积压。

- **快照不是子进程边界**——每一层同样会被物化进 `process.env`，因此项目里的普通变量会按 [`dsh-subprocess`](../../subprocess/subprocess/README.zh.md) 的清洗规则抵达子进程；产品启动器的 [`.env` 约定](../../boot/app-boot/README.zh.md) 会在物化之前拒绝 bootstrap 变量。
- **没有按工作区划分的层**——项目层是调用目录，在启动时固定；之后在 Web UI 中选择的工作区不贡献任何内容，这是刻意的，因为跟随它等于让模型自己的工作区在会话中途改变 harness 环境。

---

## 📊 指标

「待补充」

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

快照建立在一个分离之上：启动器决定存在哪些文件，快照决定值如何排序。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `createLaunchEnvironmentSnapshot`、`launchEnvironmentOf` 与 `ctx.launchEnvironment` 槽位 |

### 快照如何保持冻结

`createLaunchEnvironmentSnapshot` 在构造时复制每一层的值，因此之后对源对象的修改无法改变快照。无论构造顺序如何，查找都按规范信任顺序进行；在 Windows 上，名字在存储前折叠为大写，因此大小写变体无法拆分优先级。

### 省略意味着什么

`getFrom` 按规范顺序过滤，绝不按调用方列表的顺序。省略一层就是拒绝：该值在该调用中不可达，这正是调用方在某个决策绝不能被某层影响时使用的机制。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `createLaunchEnvironmentSnapshot`、`launchEnvironmentOf` 与 `ctx.launchEnvironment` 槽位 |

---

## 🔗 资源

当你需要构建快照的启动器或通过快照解析的消费方时，阅读以下页面。

- [boot 包](../../boot/app-boot/README.zh.md)——在任何配置项挂载之前填充 `ctx.launchEnvironment` 的启动器。
- [凭据存储](../../credentials/credentials-local/README.zh.md)——针对快照各层解析已存储的凭据。
- [DeepSeek 提供方](../../llm/llm-deepseek/README.zh.md)——通过启动环境读取提供方配置。

-----

## 已知限制与延期工作

---

## 🚀 快速开始

```ts
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'

declare const ctx: import('@deepseek-ai/cordis').Context
const endpoint = launchEnvironmentOf(ctx).get('DEEPSEEK_BASE_URL')?.value
```

解析一个值



`get(name)` 按可信度从高到低搜索所有层。`getFrom(name, sources)` 只搜索指定的层，不改变这一可信顺序——绝不能接受某一层的调用方不把它列进去，因此后续任何重新排序都无法让它回来。

`launchedThroughSsh(snapshot)` 仅在继承的进程层中存在非空 `SSH_CONNECTION` 或 `SSH_TTY` 时返回 true。Web 浏览器唤起、自适应目录选择器与 Open In 共用此判断；项目与用户 `.env` 中的值不作为 SSH 会话的依据。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-launch-environment
