---
title: "@deepseek-ai/dsh-package-manifest"
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

使用 `DshPackageManifest` 描述包元数据、`DshManifest` 描述 `dsh` 下的公共字段，以及 `DshClientManifest` 等成员类型描述单个领域。各读取方负责 JSON 解析、校验和默认值解析。

---

## ⚡ 功能

### 限制

- **仅提供静态类型。** 消费方读取并校验所需的 JSON 字段，再将共享声明适配为运行时数据。本包不提供解析器、getter helper、文件检查或默认值。
- **兼容性仅作声明。** 当前安装器和加载器不强制检查 `dsh.manifestVersion` 或 `engines.dsh`；声明范围不会拒绝不兼容的宿主，也不会校验 SemVer 语法。

---

## 📊 指标

无，因为本包仅导出类型。

#### KV Cache 影响

类型声明不增加模型输入，因此不影响提供方的缓存复用。

## 已知限制与后续工作

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

包根仅重新导出 [`src/types.ts`](src/types.ts) 中的声明。本包

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [Profile 启动器](../../boot/app-boot/README.zh.md#profiles)——manifest 加载与组合。
- [公共包元数据](../../../.agents/notes/implemented/architecture/2026-09-10-public-package-manifest.zh.md)——字段位置与读取方归属。

---

## 🚀 快速开始

```ts
import type { DshClientManifest, DshPackageManifest } from '@deepseek-ai/dsh-package-manifest'

const client: DshClientManifest = { platform: 'web' }
const manifest: DshPackageManifest = {
  name: 'example-dsh-plugin',
  version: '1.0.0',
  engines: { node: '>=24', dsh: '0.1.5-alpha.1' },
  dsh: {
    manifestVersion: 1,
    bundle: { patch: './cordis.patch.yml' },
    client,
  },
}
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-package-manifest
