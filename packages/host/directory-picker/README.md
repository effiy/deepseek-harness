---
title: "@deepseek-ai/dsh-host-directory-picker"
tags: []
category: "host"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

web GUI 让操作者通过 OS 选择器或应用内浏览器选择工作区目录。操作者能接触宿主屏幕时使用原生选项；远程客户端或需要在应用内列举和创建目录时使用浏览选项。消费方会获得交互类型，并能呈现匹配的工作流。目录选择仅限 GUI 宿主，不会影响 agent loop（智能体循环）。浏览工作流一次只公开一棵目录树；不支持多根目录。

---

## ⚡ 功能

### 限制

这些限制说明 seam 约定何时把决定留给未来的消费方。它们是当前包约束，不是任务积压。

- **不支持多根目录**——浏览约定每次列举只公开一条祖先链；按部署限定浏览根（以及在盘符根的上一级枚举 Windows 各盘符根目录）等到出现需要它的消费方再做，见 DirectoryPicker Agent Note。

---

## 📊 指标

无。GUI 宿主的目录选择 seam 不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

该 seam 建立在一个分离之上：后端提供的交互形态是约定，而不是实现细节。`DirectoryPicker` 是只有一个 `capability()` 方法的抽象 Cordis 服务；后端子类以 `ctx.directoryPicker` 注册，加载第二个实现会抛出标准的重复服务错误。能力对象在服务生命周期内必须保持稳定，因为消费方可能跨调用持有它。

### 可合并扩展的词汇

`DirectoryPickerCapabilities` 是以能力类型为键的可合并扩展映射，`DirectoryPickerCapability` 从它派生联合类型。新后端通过声明合并将其形态加入此映射（条目的 `kind` 字面量必须等于其键），而无需改动本包。每个后端包还随附一个 browser 入口，在 ui-workspace 的 directory-flow slot 中注册匹配的交互，因此一行组合配置同时选择宿主能力与客户端流程。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | Service Definition：抽象 `DirectoryPicker`、能力词汇、类型化错误、Context 合并 |

### 失败词汇

`DirectoryPickerError` 携带封闭的 `DirectoryPickerErrorCode` 加出错对象的绝对路径，消费方无需字符串匹配即可映射业务错误码。设计依据、与 `ctx.fs` 的切分与策略裁决见 seam Agent Note。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | Service Definition：抽象 `DirectoryPicker`、能力词汇、类型化错误、Context 合并 |

---

## 🔗 资源

当 seam 约定不够用时阅读以下内容：先看决策记录，再看组合它的两个后端与自适应选择器。

- [目录选择能力 seam 决策](../../../.agents/notes/archived/architecture/2026-07-28-directory-picker-capability-seam.md)——设计依据、`ctx.fs` 切分与策略裁决。
- [原生后端](../directory-picker-native/README.zh.md)——OS 选择器交互及其平台工具。
- [浏览后端](../directory-picker-browse/README.zh.md)——面向远程客户端的应用内列举与创建交互。
- [自适应选择器](../directory-picker-auto/README.zh.md)——两个后端之间的启动时判定。
- [工作区子系统](../../../docs/subsystems/workspace.zh.md)——接收所选目录的工作区记录。

---

## 🚀 快速开始

挂载且只挂载一个目录选择后端，然后让工作区流程驱动它：seam 本身只是服务约定，因此没有后端的组合就无从选择目录。

### 选择后端

当操作者坐在宿主屏幕前时，[原生后端](../directory-picker-native/README.zh.md)是正确选择：`directoryPicker/pick` 打开一个 OS 选择器，返回所选绝对路径，取消时返回 `null`。[浏览后端](../directory-picker-browse/README.zh.md)处处可用——它在浏览器中列举一个目录层级并创建子目录，因此无法触达 OS 对话框的远程客户端依然能选择工作区。当宿主处境

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-directory-picker
