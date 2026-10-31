---
title: "@deepseek-ai/dsh-sdk-client"
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

`dsh-sdk-client` 让 TypeScript 程序通过 stdio JSON-RPC 启动并驱动完整的 DeepSeek Harness 运行时。使用 `DeepSeekHarness` 可打开会话、发送文本或图像提示词、收集事件与通知流，并在运行时进入 idle 后取得最后提交的助手响应；使用 `HarnessClient` 可直接发送协议请求和订阅通知。调用方可以提供 `dshBin`；否则客户端解析同版本的 `@deepseek-ai/dsh` 可执行文件。客户端跨多次运行持有子进程，公开类型化的传输与协议错误，并在 `close()` 或 `await using` 时回收进程。它适用于调用方能够选择运行时 profile 和启动设置的场景。

---

## ⚡ 功能

### 限制

这些限制说明本客户端何时不合适或需要特别注意。它们是当前包约束，不是与其他 SDK 客户端的对比或任务积压。

- **无捆绑运行时解析**——客户端解析同版本 `@deepseek-ai/dsh` 包（或调用方提供的 `dshBin`）；打包可执行文件的发现留在 Python 侧，直到出现 TypeScript 发行版消费方。
- **无轮次中取消**——协议层没有提示词取消方法；放弃轮次意味着关闭运行时（见[协议限制](../protocol/README.zh.md#known-limitations-and-deferred-work)）。
- **没有逐提示词结果**——低层 `prompt()` 只返回入队回执；高层 `run()` 负责从回执到 idle 的收集，放弃该过程意味着关闭运行时。
- **客户端→服务端通知与服务端→客户端请求**在协议两端都未实现；传输层为未来审批流程保留了承载能力。

---

## 📊 指标

无，因为这是客户端进程库；模型可见行为存在于所 spawn 运行时组合的插件中。

#### KV Cache 影响

客户端进程中无影响。子进程的 profile、patch、提供方、模型与历史决定缓存复用。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释客户端背后的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

客户端是同一协议上的两层：`DeepSeekHarness`（自有运行）叠加在 `HarnessClient`（协议客户端）之上，与 Python SDK 的分层一致。它运行在任何 harness 上下文之外，因此直接 spawn 运行时而非经由 `dsh-subprocess` 服务——即该 seam 记录的 SDK 托管传输例外——其关闭阶梯也位于本包。运行时对上下文内每个会话都发通知；会话树范围限定是客户端对 `subagent.started` 血缘边的过滤。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/api.ts`](src/api.ts) | `DeepSeekHarness` + `HarnessSession`：自有运行、从回执到 idle 的收集、`finalResponse` |
| [`src/client.ts`](src/client.ts) | `HarnessClient`：spawn、握手、请求、订阅扇出、类型化错误 |
| [`src/dispose.ts`](src/dispose.ts) | 私有关闭阶梯：stdin EOF → SIGTERM → SIGKILL 直到真正退出 |
| [`src/types.ts`](src/types.ts) | 启动与超时选项、通知结构、`RunResult` |
| [`src/index.ts`](src/index.ts) | 消费方接口：两层客户端与面向调用方的类型 |

### 自有活动流程

一次运行会订阅会话树、把提示词排入队列，等待提示词的消息 id 出现在持久的 `agent/inbox/spliced` 回执中，然后持续收集通知，直到整个 agent 报告 `idle`。`finalResponse` 从收集到的事件中最后一条 `assistant/message` 派生。传输丢失、超时与协议违例会使本次运行被拒绝；模型结果仍可在事件流中观察，但不会归属于某一输入。

### 错误与关闭

每种失败模式都映射到一个导出的错误类——协议错误响应、请求时限已到、响应超出文档化协议、运行时死亡——调用方可以按失败类型分支处理；这四个类从 [src/index.ts](src/index.ts) 导出。关闭采用私有的幂等阶梯（stdin EOF → SIGTERM → SIGKILL），位于 [src/dispose.ts](src/dispose.ts)，只在进程真正退出时结束。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文，明确不具权威性——已交付的行为与限制见上文各节与代码。启动规格有意保持完全显式：在出现 TypeScript 发行版消费方之前，不计划做捆绑运行时解析。请让关闭阶梯与错误词汇与驱动同一运行时的 Python 客户端保持同步。没有记录其他未解决的开放设计问题。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/api.ts`](src/api.ts) | `DeepSeekHarness` + `HarnessSession`：自有运行、从回执到 idle 的收集、`finalResponse` |
| [`src/client.ts`](src/client.ts) | `HarnessClient`：spawn、握手、请求、订阅扇出、类型化错误 |
| [`src/dispose.ts`](src/dispose.ts) | 私有关闭阶梯：stdin EOF → SIGTERM → SIGKILL 直到真正退出 |
| [`src/types.ts`](src/types.ts) | 启动与超时选项、通知结构、`RunResult` |
| [`src/index.ts`](src/index.ts) | 消费方接口：两层客户端与面向调用方的类型 |

---

## 🔗 资源

当客户端约定不够用时阅读以下页面。它们从协议格式进入服务插件与使用本客户端的应用。

- [SDK 协议格式](../protocol/README.zh.md)——本客户端使用的 JSON-RPC 方法与载荷结构。
- [JSON-RPC 服务插件](../server/README.zh.md)——服务本客户端的运行时插件。
- [Python SDK](../../../python/README.zh.md) — 共享同一运行时对端与协议的设计孪生。
- [SDK subagent 后端](../../subagent/subagent-dsh-sdk/README.zh.md) — harness 内部消费本客户端的例子。
- [SDK 应用组合包](../../bundle/sdk-app/README.zh.md) — 本客户端启动的 `dsh --profile sdk` 运行时应用。

---

## 🚀 快速开始

```ts
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'

await using harness = new DeepSeekHarness({
  profile: 'sdk',
  patches: ['./automation.cordis.yml'],
  provider: 'deepseek-official',
  model: 'deepseek-v4-flash',
  reasoningEffort: ReasoningEffortId('max'),
  maxTokens: 49_152,
})
const result = await harness.run('say hi')
console.log(result.finalResponse)
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-client
