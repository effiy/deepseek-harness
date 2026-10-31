---
title: "@deepseek-ai/dsh-sdk-protocol"
tags: []
category: "sdk"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-sdk-protocol` 让 DeepSeek Harness 运行时与其 SDK 客户端通过按换行分帧的字节流交换 JSON-RPC 2.0 消息：一个传输类，加上协议两端共同使用的具名请求、结果与通知类型。服务端是 [`dsh-sdk-jsonrpc-server`](../server/README.zh.md) 插件；客户端是 TypeScript 的 [`dsh-sdk-client`](../client/README.zh.md) 与 [Python SDK](../../../python/README.zh.md)（后者复现这些结构但不导入它们）。当你实现或调试协议某一端时使用本包：分帧规则、方法名、载荷类型与错误语义都在这里。它是纯库——无插件、无配置、无注册。

---

## ⚡ 功能

### 限制

这些限制说明协议未覆盖或未承诺的内容。它们是当前包约束，不是与其他协议格式的对比或任务积压。

- **无协议版本协商**——握手只携带 `serverInfo.version`（`0.0.1`，客户端不校验）；处于预发布阶段，无兼容承诺。
- **无取消与会话关闭方法**——客户端放弃轮次的方式是关闭运行时进程；见 [JSON-RPC 服务插件](../server/README.zh.md)。
- **server→client 请求是未使用的能力**——传输层支持，但服务器从不发送；Python SDK 的应答接口为未来审批流程预留。

---

## 📊 指标

无，因为这是面向客户端的协议库；模型可见行为归对外服务入口后方的运行时插件所有。

#### KV Cache 影响

无；此包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释协议库背后的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本包采用一种职责分离设计：两个协议端共用一个按换行分帧的传输类，并以具名类型索引协议方法。包根是唯一的导入面——源模块不支持深层导入。它是没有插件、配置或注册的纯库；服务插件与客户端负责其周围的一切行为。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/transport.ts`](src/transport.ts) | `JsonRpcLineTransport`：行分帧、请求/响应/通知分发、错误映射、挂起请求记账 |
| [`src/types.ts`](src/types.ts) | 具名请求/结果与通知载荷类型，按方法索引 |
| [`src/index.ts`](src/index.ts) | 消费方接口：传输与具名协议类型 |

### 帧分发

入站行逐条解析：带 `id` 与 `method` 的帧通过请求处理器应答（或应答 `-32601`），仅 `id` 的帧结算匹配的挂起请求（错误帧以 `JsonRpcResponseError` 拒绝它），仅 `method` 的帧交给通知处理器。`start()` 挂接输入监听器；`close()` 移除它们并在不销毁流的情况下失败所有挂起请求。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文，明确不具权威性——已交付的行为与限制见上文各节与代码。本协议的各个结构由 Python SDK 复现（而非导入），因此在这里更改方法、载荷或协议稳定值 `serverInfo.name` 时，必须在同一次变更中更新 Python 对侧与 TypeScript 客户端。没有记录其他未解决的开放设计问题。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/transport.ts`](src/transport.ts) | `JsonRpcLineTransport`：行分帧、请求/响应/通知分发、错误映射、挂起请求记账 |
| [`src/types.ts`](src/types.ts) | 具名请求/结果与通知载荷类型，按方法索引 |
| [`src/index.ts`](src/index.ts) | 消费方接口：传输与具名协议类型 |

---

## 🔗 资源

当协议约定不够用时阅读以下页面。它们从服务插件进入客户端与可运行应用。

- [JSON-RPC 服务插件](../server/README.zh.md) — 通过 stdio 服务该协议的运行时插件。
- [TypeScript SDK 客户端](../client/README.zh.md) — 驱动该协议的客户端。
- [Python SDK](../../../python/README.zh.md) — 复现这些结构的 Python 对应实现。
- [SDK 应用组合包](../../bundle/sdk-app/README.zh.md) — 启动服务器的 `dsh --profile sdk` 应用。

---

## 🚀 快速开始

分帧与传输

在你拥有的字节流上，每个 `\n` 结尾的行承载一条 JSON-RPC 2.0 消息。同时带 `id` 与 `method` 的帧是请求，仅 `id` 是响应，仅 `method` 是通知；格式错误的行会被忽略。没有注册处理器的请求应答 `-32601`，处理器失败应答 `-32603`，错误响应会以 `JsonRpcResponseError` 拒绝挂起的请求，并保留协议中的 `code` 与可选 `data`。`start()` 挂接流监听器，`close()` 移除监听器并拒绝挂起请求，但不销毁流。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-protocol
