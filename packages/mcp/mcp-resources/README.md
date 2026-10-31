---
title: "@deepseek-ai/dsh-mcp-resources"
tags: []
category: "mcp"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-mcp-resources` 让模型发现和读取已配置 MCP 服务器提供的文档。随附 profile 在调用方作用域中配置了服务器时，自动提供三个共享工具。每个工具都要求显式指定服务器名称，并且仅在调用时读取内容。资源文本进入对话历史；二进制载荷仍可供程序化调用方访问，并以说明文字呈现给模型。

---

## ⚡ 功能

### 限制

资源访问由显式调用按需发起。

- 不具备 MCP `resources` 能力的已配置服务器仍会出现在服务器名称提示词中，并保持共享资源工具可用。SDK 返回空的资源列表与模板列表；不受支持的读取会失败。
- `tools.restrict()` 在注册过滤条件时检查全局或祖先作用域提供的名称。引用这些作用域中不存在的资源工具名称会报未知工具错误。注册在调用方自身作用域中的资源工具不受 allow/deny 掩码过滤。
- 不支持资源订阅与更新通知；再次调用列表或读取工具以获取当前内容。
- 二进制资源不会投影为原生图片或音频。程序化调用方保留其规范 base64 值。
- 调用方必须提供服务器名称。共享工具不会聚合不同服务器；分页遵循 MCP SDK。

---

## 📊 指标

### 共享资源工具

#### 模型看到什么

[生成的工具 schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-mcp-resources)定义了调用方可见的所有已配置服务器共享的三个工具。没有这类服务器时，native schema、PTC 声明与绑定以及服务器名称提示词均不存在。激活的客户端连接、断开或重试时，这些共享工具定义保持不变。挂载系统提示词装配且存在可见提供方时，`MCP resource servers` 段落显示 `Use list_mcp_resources, list_mcp_resource_templates, or read_mcp_resource with one of these names as the server argument: <JSON array>.` 名称来自同一作用域注册表，包括既没有工具也没有指令的服务器。注册表为空时不贡献该段落。

#### Token 影响

没有调用方可见的已配置服务器时，本包不增加工具或提示词 token。否则，三个共享定义带来固定的 schema 开销，服务器名称段落增加按序排列的可见名称 JSON 列表。资源列表和文档仅在操作返回后增加内容。

#### KV Cache 影响

添加调用方可见的首个服务器或移除最后一个服务器，会改变后续工具 schema 或 PTC 声明前缀。可见名称变化时更新服务器名称段落；替换同名提供方不会改变该文本。单纯的连接失败不会改变共享定义或名称。

### 资源结果

#### 模型看到什么

成功结果以 `MCP server: <server>` 开头，随后是换行和返回的 JSON。每个字符串值的 `blob` 都变为 `[binary resource: <length> base64 characters; available to programmatic callers]`。服务器提供的文本、元数据与续传游标仍然可见。

#### Token 影响

渲染后的结果向工具历史添加文本。二进制说明文字替代载荷的 base64 token 开销；本包不设置额外的文本大小限制。

#### KV Cache 影响

每个结果追加到历史中，不改写此前的结果。后续读取可以返回已变化的服务器内容并追加不同结果；本包不会刷新此前已记录的内容。

## 已知限制与延后工作

---

## 🏛️ 设计

<details>
<summary>实现内部细节——点击展开</summary>

[base](../../bundle/base/README.zh.md) 与独立的 [sdk-minimal](../../bundle/sdk-minimal/README.zh.md) bundle 分别拥有以下配置行：

```yaml
- id: mcp-resources
  name: '@deepseek-ai/dsh-mcp-resources'
```

作用域中的首个提供方注册该作用域的共享工具；移除最后一个提供方会移除本地工具注册，继承的提供方与工具仍然可见。资源服务独立于首个提供方插件拥有共享工具 effect，因此卸载该提供方不会移除其他服务器仍需要的工具。提供方选择与服务器名称提示词使用同一作用域注册表。每次调用都在派发前解析服务器。

规范结果为程序化调用方保留完整 JSON。纯文本渲染器添加服务器归属信息，并将字符串值的 `blob` 字段替换为说明其 base64 长度的文字；URI、MIME 类型与文本字段仍保留在渲染后的 JSON 中。工具流水线负责记录结果。服务器指令归 MCP 客户端及其已记录的系统提示词段落所有。

| 源码 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 作用域提供方选择与服务器名称提示词上下文 |
| [`src/tools.ts`](src/tools.ts) | 共享资源操作与参数 schema |
| [`src/render.ts`](src/render.ts) | 带归属信息且不内联二进制载荷的文本投影 |

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

以下页面介绍服务器配置、执行机制与资源访问决策。

- [MCP 客户端](../mcp-client/README.zh.md)——服务器传输、指令与连接生命周期。
- [工具子系统](../../../docs/subsystems/tools.zh.md)——规范值与模型可见结果。
- [资源可见性参考](README.zh.md)——profile 统一挂载及由已配置服务器决定的可见性。
- [资源与指令参考](README.zh.md)——作用域、按需访问及未纳入的机制。

---

## 🚀 快速开始

### 配置

```yaml
- id: mcp-resources
  name: '@deepseek-ai/dsh-mcp-resources'
```

### 参数

| 源码 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 作用域提供方选择与服务器名称提示词上下文 |
| [`src/tools.ts`](src/tools.ts) | 共享资源操作与参数 schema |
| [`src/render.ts`](src/render.ts) | 带归属信息且不内联二进制载荷的文本投影 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-mcp-resources
