---
title: "@deepseek-ai/dsh-tool-str-replace-editor"
tags: []
category: "fs"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-tool-str-replace-editor` 提供基于 `ctx.fs` 的独立面向模型 `str_replace_editor` 工具：`view` 显示带行号的文件内容或浅层目录列表，`create` 创建新文件，`str_replace` 应用唯一的字面量替换，`insert` 在选定的边界处插入行。它可以与持久 Bash、一次性 Bash、沙箱 Bash 或其他终端接口组合。修改操作遵守与 fs 家族其余部分相同的编辑前读取策略与沙箱围栏，具体由所挂载的后端与策略插件强制执行。当部署需要 Claude Code 风格、使用绝对路径的单一编辑器工具时选择它；`dsh-tool-fs` 包提供替代的 `read`/`write`/`edit` 套件。

---

## ⚡ 功能

### 限制

这些限制说明编辑器工具何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是通用编辑器对比或任务积压。

- **操作面向 UTF-8 文本**——不支持二进制文件。
- **`str_replace` 刻意拒绝零匹配或多匹配**——它没有 `replace_all` 参数。
- **每个修改操作都会经过已挂载的策略与沙箱**——`fs/write-intent` 或 `fs/edit-intent` 解析当前会话的沙箱策略，并把强制执行委托给已挂载的文件系统与策略插件，因此未挂载它们的部署会得到无条件变更。

---

## 📊 指标

### 工具 schema

#### 模型看到的内容

生成的 [`str_replace_editor` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-str-replace-editor)，包含配置的 `description`。本插件不贡献独立系统提示词段。

#### Token 影响

`str_replace_editor` 可见时产生固定的 schema 成本。

#### KV Cache 影响

配置的描述与 schema 不变时前缀稳定。

### 工具结果

#### 模型看到的内容

查看操作返回带行号文本或浅层目录列表。调用会提供文件位置，创建/替换调用还会向展示层提供 diff 卡片。修改操作返回简洁确认。长查看结果保留前缀并追加截断提示。

#### Token 影响

随数据变化，并受 `maxOutputChars` 与固定截断提示约束。

#### KV Cache 影响

工具结果以追加方式位于可复用请求前缀之后。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释编辑器工具背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

该工具是基于 `ctx.fs` 的单一 schema、四个命令。修改操作绝不带着自己的假设直接触碰提供方：每个操作都运行 `fs/write-intent` 或 `fs/edit-intent` waterfall（瀑布式事件）以取得策略插件的防护，在已挂载的 `ctx.fs` 实施沙箱限制时解析每次调用的沙箱策略，并把强制执行委托给提供方。`str_replace` 与 `insert` 还会重新读取文件，并在没有策略插件提供防护时把观察到的版本作为比较并交换的基础。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 整个工具：schema、命令分派、查看渲染、修改策略 |

### 各命令如何运行

每个命令都先解析绝对路径；修改操作随后遵循同一条共享流程——策略防护、提供方强制执行、成功后记录 `fs/observed`——而 `view` 只执行 stat 并渲染。整个工具——schema、命令分派与查看渲染——都位于 `src/index.ts`。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 整个工具：schema、命令分派、查看渲染、修改策略 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从工具逐步进入它所组合的约定、策略与后端。

- [文件系统子系统](../../../docs/subsystems/filesystem.zh.md)——穷尽式提供方约定、策略事件与错误分类体系。
- [dsh-fs](../fs/README.zh.md)——本工具消费的 `ctx.fs` 约定。
- [tool-fs](../tool-fs/README.zh.md)——替代的 `read`/`write`/`edit` 工具套件。
- [fs-observation-policy](../fs-observation-policy/README.zh.md)——通过 `fs/*` 事件防护变更的策略插件。
- [fs-sandbox](../fs-sandbox/README.zh.md)——围栏变更的沙箱强制后端。
- [生成工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-str-replace-editor)——本包注册的穷尽式 schema。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-fs-observation-policy'
- name: '@deepseek-ai/dsh-tool-str-replace-editor'
```

### 参数

| 键 | 默认值 | 含义 |
|---|---|---|
| `maxOutputChars` | `16000` | 文件和目录查看结果保留的前缀字符数 |
| `description` | `Custom editing tool for viewing, creating and editing files`（多行） | 面向模型的工具描述 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-tool-str-replace-editor
