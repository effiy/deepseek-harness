---
title: "@deepseek-ai/dsh-sdk-jsonrpc-server"
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

`dsh-sdk-jsonrpc-server` 通过 stdio 服务 SDK 协议格式（wire format），使进程外客户端能够驱动 harness agent（智能体）：它为每个 `sessionId` 打开一个会话、把用户提示词排入队列，并把每个会话事件与 agent 状态转换流式发回客户端。把它作为 `jsonrpc` 插件挂载到 Loader 组合中；外围插件树提供其余一切——agent、模型适配器、持久化与工具。Stdout 只承载 JSON-RPC 帧，因此部署不得组合 stdout logger。它通过 dispose（资源释放）根运行时并以 0 退出应答 `shutdown`；EOF 与信号退出归 app bin 负责。

---

## ⚡ 功能

### 限制

这些限制说明本插件何时需要特别的运维注意。它们是当前包约束，不是与其他服务方式的对比或任务积压。

- **协议没有逐会话关闭或提示词取消方法**——SDK 创建的 agent 会一直存活到进程关闭。
- **没有逐提示词结果**——`MessageId` 只标识 inbox 准入；拥有自动化活动区间的客户端必须自行定义并观察该区间。
- **stdout 纯净性由部署保证**——外围配置仍可能加载 stdout logger 并破坏 JSON-RPC 通道；此插件不会检查或否决同级 logger。
- **自动挂载适配器仅支持 DeepSeek**——`initialize` 可以复用任何预先注册的模型适配器，但唯一的回退行为是挂载 DeepSeek 适配器。

---

## 📊 指标

### SDK 用户消息

#### 模型看到什么

对于每个已接受的 `session/prompt`，文本和持久内容引用会原样进入一条用户消息。内联 `SdkEncodedImageBlock` 会先通过组合中的附件存储完成校验与提交，因此会话日志保留内容寻址的图片引用而不是 base64 字节。此包不会添加系统提示词文本或工具 schema；这些内容来自组合中的其他插件。

#### Token 影响

依数据而定的用户消息 token 会进入保留的会话历史，并在后续轮次中重复发送，直至另一个包将其压缩（compaction）。JSON-RPC 帧、会话通知与服务器内部记录不会增加模型上下文 token。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释服务插件背后的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本插件是轻量的展示适配器：[`HarnessSdkJsonRpcServer`](src/server.ts) 负责协议方法与通知，传输与具名协议类型来自 `dsh-sdk-protocol`，与客户端 SDK 共享。它订阅会话、agent 与 subagent 生命周期事件，并把它们作为协议通知转发；只有当服务在生命周期建立快照时记录的 `local` 标志为 true 时才转发 subagent 完成事件——提供方名称、子级 id 与持久化谱系均不能证明本地性。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config` schema、stdio 接线、请求分发、共享关闭与退出任务 |
| [`src/server.ts`](src/server.ts) | `HarnessSdkJsonRpcServer`：协议方法、逐会话 agent 创建、生命周期订阅、清理 |

### 请求流程

每个协议方法在执行前都会校验输入并解析负责该请求的状态——`initialize` 保存 SDK 路由，`session/prompt` 解析存活的 agent 与会话配对并排入消息，`shutdown` 刷新响应，再 dispose 根上下文使其达到完全停稳，最后以 0 退出——共享退出任务确保竞争的 `shutdown` 请求绝不会重复 dispose 或退出。分发逻辑位于 [src/index.ts](src/index.ts) 与 [src/server.ts](src/server.ts)。

### 清理

`server.shutdown()` 关闭其精确根 Agent 下的后代准入，按子级优先顺序排空托管后代，再释放根句柄与适配器。它移除自身订阅，而仅卸载本插件时，无关父级树与外围上下文保持运行。后代排空失败会在其余根句柄与适配器的清理完成后报告。协议 `shutdown` 则 dispose 根 fiber，使持久化与整个运行时在进程退出前达到完全停稳。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文，明确不具权威性——已交付的行为与限制见上文各节与代码。单文件可执行运行时分发将本插件与打包的 `jsonrpc-demo` bin 配对；请让关闭与退出约定与负责 EOF 和信号退出的 app bin 保持一致。没有记录其他未解决的开放设计问题。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config` schema、stdio 接线、请求分发、共享关闭与退出任务 |
| [`src/server.ts`](src/server.ts) | `HarnessSdkJsonRpcServer`：协议方法、逐会话 agent 创建、生命周期订阅、清理 |

---

## 🔗 资源

当插件约定不够用时阅读以下页面。它们从协议格式进入客户端与可运行应用。

- [SDK 协议格式](../protocol/README.zh.md) — 本插件服务的协议方法与载荷结构。
- [TypeScript SDK 客户端](../client/README.zh.md) — 驱动本插件的客户端。
- [SDK 应用组合包](../../bundle/sdk-app/README.zh.md) — 启动本插件的 `dsh --profile sdk` 应用。
- [Python SDK](../../../python/README.zh.md) — 驱动同一服务器的 Python 客户端。
- [SDK 运行时分发决策](../../../.agents/notes/implemented/architecture/2026-07-10-single-file-executable-sdk-runtime-distribution.zh.md) — 打包运行时为何服务封闭插件树。

---

## 🚀 快速开始

`session/working-directory/get` 接收 `{ sessionId }`；`session/working-directory/set` 接收 `{ sessionId, path }`。两者均返回 `{ cwd }`，并可创建未知 Session，而不启动模型轮次。读取通过工作目录服务恢复缺失目录；修改保留起始目录元数据与权限，并通过已记录的用户上下文告知模型。

当运行时必须服务 SDK 客户端时挂载本插件：把它加入组合了 agent 服务的 `cordis.yml`，启动运行时，客户端即可通过 stdio 连接。常用路径是显式的——插件需要 `agents` 

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-server
