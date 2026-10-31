---
title: "@deepseek-ai/dsh-lazy-require"
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

`dsh-lazy-require` 会让 CommonJS 兼容的 Host 依赖保持未加载状态，直到首次实际操作。解析仍以消费方 package 为基准，同一进程 realm 会复用一次成功加载的模块值。

---

## ⚡ 功能

### 限制

- **仅限兼容 CommonJS 的依赖**——仅 ESM package 需要由调用方拥有异步 factory。
- **WebWorker 打包需要显式请求**——静态 packer 无法发现仅在 `createLazyRequire()` 调用中命名的依赖。Preview image 使用的 package 必须通过受支持的字面量请求保持该依赖可达，直到 packer 能够识别此 helper。

---

## 📊 指标

无，因为本 Host 工具不注册任何模型可见行为。

#### KV Cache 影响

无。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本工具使用传入的调用方 URL 创建 Node `require`，并且只缓存成功返回的值。显式调用方 URL 会在发布后保留 package 局部的依赖解析。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 按调用方解析的 loader 与成功结果缓存 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 按调用方解析的 loader 与成功结果缓存 |

---

## 🔗 资源

- [工具包地图](../README.zh.md)——相邻的共享原语。
- [NPM 发布序列](../../../.agents/notes/implemented/process/2026-08-10-npm-release-sequences.zh.md)——发布依赖分类与首次使用加载策略。

---

## 🚀 快速开始

```ts
import { createLazyRequire } from '@deepseek-ai/dsh-lazy-require'

interface NativeModule { open(): void }
const requireNative = createLazyRequire<NativeModule>('native-package', import.meta.url)
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-lazy-require
