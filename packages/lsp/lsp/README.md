---
title: "@deepseek-ai/dsh-lsp"
tags: []
category: "lsp"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用 `dsh-lsp` 为 agent（智能体）提供语言服务器导航，包括定义、引用、实现与悬停文档。查询按文件扩展名选择已配置的提供方，并返回规范化结果与结构化错误，因此更换后端不会改变导航请求或模型可见的响应。导航只读，并刻意排除通用 JSON-RPC 访问、重命名、格式化、诊断与符号列表。本包必须与 `dsh-lsp-stdio` 等提供方及面向模型的 `dsh-tool-lsp` 组合；单独使用时不提供导航。

---

## ⚡ 功能

### 适用场景

当部署希望模型可见的代码导航由语言服务器支撑时，选择此服务。它覆盖只读导航——定义、引用、实现与悬停——并刻意排除修改（重命名、code action、格式化）、符号列表与诊断。该服务提供方无关：本地 stdio 服务器、远程服务器与沙箱原生提供方都以相同方式注册，因此更换后端不会改变模型看到的内容或请求方式。

### 限制

这些限制定义 seam 当前的范围。它们是包约束，不是任务积压。

- **同一运行时内扩展名归属互斥**——两个提供方不能同时声明 `.ts`，即使 language id 不同；重叠会使注册失败。预期扩展是在注册之上增加部署配置的 selector，它可以在不把提供方选择加入模型输入的前提下放宽互斥保留。
- **仅四种只读操作**——symbol 与 call hierarchy 因需要不同 schema 而推迟；diagnostics 需要独立的新鲜度与累积规则；修改（重命名、code action、格式化）需要独立工具，并集成预览、权限与写入策略。
- **没有观测表层**——可用性只能通过运行 `query()` 并按抛出的 `LspError` code 路由来观测；没有提供方变更事件或能力状态查询。

---

## 📊 指标

通过 `dsh-tool-lsp` 间接影响；该工具拥有面向模型的 `lsp` schema、提示词指引与渲染结果，本注册表自身不贡献提示词或 schema。

#### KV Cache 影响

不会直接失效；请求前缀变更由 `dsh-tool-lsp` 负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释 seam 背后的设计决策并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

- **能力 seam，Service Definition 角色。** 本包拥有 `ctx.lsp` 与提供方注册表；提供方注册的是能力而非工具，`dsh-tool-lsp` 是面向模型表层的唯一 owner。
- **原子注册。** `registerProvider()` 在变更前验证并检查全部冲突：无效或冲突的注册不会发布任何内容，其 disposer 会一并释放 id 与全部扩展名保留。
- **与顺序无关的选择。** `query()` 按文件的最终扩展名（规范化为小写、以点开头的形式）路由；注册与 HMR（热模块替换）顺序绝不会改变路由。language id 只用于同步临时文档，绝不参与选择。
- **封闭的词汇。** 四种操作的联合是封闭的——新增操作是跨 seam、提供方与工具的编译期强制变更。没有 JSON-RPC 逃生口，且每个请求字段都必填，因此不存在 `resolve()` 步骤。
- **提供方拥有的工作区坐标。** 位置结果携带提供方的规范工作区 URI，消费方据此在执行世界的命名空间内相对化文件 URI，而不是应用宿主平台路径规则。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Lsp` 服务、`registerProvider`／`query`、`finalExtension`、`LspError` code |
| [`src/types.ts`](src/types.ts) | seam 词汇：请求、结果、提供方与服务约定 |
| [`src/brand.ts`](src/brand.ts) | `LspProviderId` 品牌化 id 类型与工厂 |

### 注册与选择生命周期

注册与释放通过 `ctx.effect()` 执行，因此提供方路由随注册 fiber 一同存活与消亡。`finalExtension()` 按两种路径分隔符切分，对没有扩展名的名称或点开头的 dotfile 返回 `''`，任何路由都不会匹配。`LspError` 扩展 `HarnessError`，携带稳定的 code（`LSP_INVALID_PROVIDER`、`LSP_CONFLICT`、`LSP_UNAVAILABLE`、`LSP_DISPOSED`、`LSP_UNSUPPORTED_OPERATION`、`LSP_MALFORMED_RESPONSE`），调用方据此路由，而不是解析 `message`。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Lsp` 服务、`registerProvider`／`query`、`finalExtension`、`LspError` code |
| [`src/types.ts`](src/types.ts) | seam 词汇：请求、结果、提供方与服务约定 |
| [`src/brand.ts`](src/brand.ts) | `LspProviderId` 品牌化 id 类型与工厂 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从共享的导航模型逐步进入提供方与工具。

- [LSP 导航子系统](../../../docs/subsystems/lsp.zh.md)——操作、坐标、请求与结果，以及 `LspError` code。
- [dsh-lsp-stdio](../lsp-stdio/README.zh.md)——注册到该 seam 的 stdio 提供方。
- [dsh-tool-lsp](../tool-lsp/README.zh.md)——基于该 seam 的面向模型工具。
- [lsp 组地图](../README.zh.md)——三个包的家族及其相关文档。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-subprocess-local'
- name: '@deepseek-ai/dsh-lsp'
- name: '@deepseek-ai/dsh-lsp-stdio'
- name: '@deepseek-ai/dsh-tool-lsp'
```

### 参数

| 操作 | agent 获得的内容 |
|---|---|
| `goToDefinition` | 光标处符号的定义位置 |
| `findReferences` | 所有引用，始终包含声明 |
| `goToImplementation` | 具体实现位置 |
| `hover` | 该符号的规范化文档，或没有 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-lsp
