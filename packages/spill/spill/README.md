---
title: "@deepseek-ai/dsh-spill"
tags: []
category: "spill"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-spill` 让插件和工具通过公开的 `ctx.spillStore` API 保存超大文本，并取得不透明定位信息、精确字节数与取回指引。当完整结果必须保持可取回、同时又不能填满模型上下文时选择它。配置 `dsh-spill-local` 可获得本地持久化；当超大工具结果应变为有界预览时，再添加 `dsh-spill-policy`。该 API 不提供保留、替换、取回或搜索操作。存储故障会使保存操作拒绝，由调用方决定保留内联内容还是让操作失败。

---

## ⚡ 功能

### 适用场景

当部署需要在模型看到有界预览后仍能取回全文时，选择 spill 存储，例如抓取的页面正文或已捕获的会话引用 transcript。前提是后端的定位信息与取回指引在部署环境中可用；该服务不要求本地文件系统访问。

### 限制

这些限制说明 spill 存储服务单独使用时在哪些方面不完整。它们是当前的包约束。

- **没有取回或删除 API**——消费方只能渲染后端的定位信息与指引；生命周期与访问语义仍由后端自行决定。
- **存储不等于访问控制**——所属会话区分写入命名空间，但不会授权通过定位信息读取内容；每个后端与取回消费方都必须自行强制执行访问边界。

---

## 📊 指标

spill 消费方将后端的定位信息与取回指引渲染给模型，从而间接影响模型体验。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释该服务背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本包建立在一个分离与刻意的极简之上：

- **约定、实现与策略保持分离。** 本包定义后端做什么（`saveText`）；`dsh-spill-local` 实现它；`dsh-spill-policy` 决定何时触发。各项关注点独立演进与替换。
- **只有一个方法，别无其他。** 该 seam 不负责保留策略、结果替换或取回/搜索 API——那些都有各自的归属包。
- **在 seam 处拒绝，绝不静默降级。** 降级由调用方负责；seam 报告真实存储故障。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `SpillStore` 服务及其 `saveText` 约定 |
| [`src/types.ts`](src/types.ts) | 词汇：`SaveTextSpill`、`SpillRef`、带品牌类型 `SpillLocator`、`SpillOwner`、`SpillSource` |

### 数据模型

`SaveTextSpill` 将存储归属与描述性来源信息分开。`SpillSource` 接受工具来源 `{ kind: "tool", toolName, callId, label }` 或 `{ kind: "session-reference", sessionId, label }`，后者的 id 标识被捕获的源会话。会话引用绝不伪造工具调用 id。来源信息与归属命名空间都不授予读取权限。消费方把返回的定位信息视为不透明值，并与取回指引一同展示。

### 生命周期

后端继承 `SpillStore` 并以插件方式加载，注册为 `ctx.spillStore`；每个上下文只有一个实现，第二次加载会失败。执行 dispose（资源释放）时会释放该服务。抽象类本身不注册任何内容——本包只提供约定与词汇。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：尚未决定的探索方向与开放问题。它明确不具权威性。

#### 未来：执行器 spill 文件集成

该 seam 只有 `saveText`；为既有执行器 spill 文件提供保存文件或链接/复制路径（例如规范化 bash 临时文件），以及为 subagent 展开提供工具自有 spill，仍然延期，见[工具输出 spill 决策](../../../.agents/notes/implemented/architecture/2026-07-08-tool-output-spill-files.zh.md)。

#### 未来：非本地后端与清理

远程或数据库后端仍是开放方向。本地后端执行其[启动清理策略](../spill-local/README.zh.md#startup-cleanup)；该服务未定义按会话清理或刷新定位信息的 API。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `SpillStore` 服务及其 `saveText` 约定 |
| [`src/types.ts`](src/types.ts) | 词汇：`SaveTextSpill`、`SpillRef`、带品牌类型 `SpillLocator`、`SpillOwner`、`SpillSource` |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从共享词汇逐步进入已交付后端、策略与设计依据。

- [spill 子系统](../../../docs/subsystems/spill.zh.md)——穷尽式词汇、归属与后端关系。
- [spill 包映射](../README.zh.md)——三包家族与各自职责。
- [dsh-spill-local](../spill-local/README.zh.md)——已交付的本地文件系统后端。
- [dsh-spill-policy](../spill-policy/README.zh.md)——决定最终结果何时过大的策略。
- [dsh-output-retention](../../util/output-retention/README.zh.md)——策略背后的预览机制。
- [工具输出 spill 决策](../../../.agents/notes/implemented/architecture/2026-07-08-tool-output-spill-files.zh.md)——能力边界与设计依据。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-spill-local'
- name: '@deepseek-ai/dsh-spill-policy'
  config:
    maxInlineTokens: 12500
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `SpillStore` 服务及其 `saveText` 约定 |
| [`src/types.ts`](src/types.ts) | 词汇：`SaveTextSpill`、`SpillRef`、带品牌类型 `SpillLocator`、`SpillOwner`、`SpillSource` |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-spill
