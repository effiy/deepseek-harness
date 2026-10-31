---
title: "@deepseek-ai/dsh-host-plugin-inventory"
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

客户端可以调用 `pluginInventory/list`，按加载顺序展示宿主的当前插件，包括每个条目的标识符、模块标识、有效启用状态、存活阶段与可用的展示文本。部署组合了 agent preset roster 时，还会报告各预设的元数据、健康状态与压平后的插件组合；没有 roster 时，预设数据缺席。每次响应都是供展示和诊断使用的只读即时快照：它不能修改插件，也不提供历史或变更订阅。

---

## ⚡ 功能

### 限制

这些限制说明即时清单无法向客户端提供哪些信息。它们是当前包约束，不是任务积压。

- **仅表示调用当下**——结果不包含持久的失败历史或订阅；只要不存在存活的根 Fiber，就会报告 `null`，而不区分其原因。
- **不标识引入层，也不修改插件**——服务不识别条目由哪个 bundle、profile 或 override 引入，也不能在任一平面启用、停用、添加或移除插件。
- **预设仅随 roster 出现**——未装 `dsh-agent-preset-registry` 的部署只提供 Loader 条目；`agentPresets` 字段缺席而非为空。

---

## 📊 指标

无。这个仅限 Host 的只读 Loader 投影不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

网关是一层没有第二个生命周期真源的直接投影：每次 `list()` 调用都读取 `ctx.loader.entries()`，并把每个非组条目映射为公共行。Cordis 内部的 `plugin/status` 事件已经维护了 `Entry.fiber` 与 `Fiber.state`，因此再加缓存只会多出一个需要同步的生命周期真源。agent preset roster 是每次调用经 `ctx.get('agentPresets')` 解析的可选伙伴：预设组合读取由它的 `compositionInventory()` 负责，本包把根 Fiber 状态映射到公共阶段。

展示元信息来自可选的 `pluginPackages` 服务：Loader 行使用其所属树的解析基准，预设行使用网关上下文的基准。服务或对应基准不存在时，`meta` 缺席。读取元信息不会加载或激活插件。

### 阶段映射

Fiber 状态映射到公共阶段词汇，其中 `disposed` 折叠为 `null`——fiber 已消失的条目没有可报告的存活根。因此阶段从不区分为什么没有存活根：条目可能从未启动，也可能其 fiber 已被释放。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `PluginInventoryGateway`：`pluginInventory` Remote 服务与 Loader 投影 |
| [`src/types.ts`](src/types.ts) | 公共 payload 类型：`PluginInventoryEntry`、`PluginInventorySnapshot`、`PluginFiberPhase` |

Typert 生成由 `./typert` 与 `./remote` 导出的 Host 和 Client Remote 产物。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `PluginInventoryGateway`：`pluginInventory` Remote 服务与 Loader 投影 |
| [`src/types.ts`](src/types.ts) | 公共 payload 类型：`PluginInventoryEntry`、`PluginInventorySnapshot`、`PluginFiberPhase` |

---

## 🔗 资源

当清单约定不够用时阅读以下内容：先看 Remote 如何到达客户端，再看它所投影的 Loader 与渲染它的界面。

- [Remote 组合](../../api/remotes/README.zh.md)——客户端如何在不导入 Host 实现的情况下消费 `pluginInventory/list`。
- [Cordis 插件 loader](../../../vendor/loader/README.md)——本包所投影条目的那个 Loader。
- [插件清单设置界面](../../client/ui-settings-plugin-inventory/README.zh.md)——渲染该清单的浏览器侧投影。

---

## 🚀 快速开始

当客户端或设置页需要展示宿主当前组合了什么——哪些插件已加载、已启用、是否存活，以及每个 agent preset 会给会话什么——时调用 `pluginInventory/list`。Remote 是唯一入口：该服务仅供 Remote 使用，刻意不声明同进程 Cordis `Context` 合并。

### 快照包含什么

每一行是一个非组 Loader 条目：其条目 id、精确模块标识、有效启用状态（含被禁用的祖先组）与当前根 Fiber 阶段。`pending` 表示条目等待加载，`loading` 表示正在读取，`active` 表示正在运行，`failed` 表示其 fiber 被

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-plugin-inventory
