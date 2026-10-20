---
title: "@deepseek-ai/dsh-llm-retry"
tags: []
category: "llm"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

挂载 `@deepseek-ai/dsh-llm-retry`，可在持久 agent 步骤边界重试失败的模型请求。提供方的 `retryPolicy` 设置可选择有界的 normal mode 重试或无上限的 always mode 重试；计划的尝试会在退避前写入会话日志，取消后历史仍保持一致。重试会在同一个打开的轮次内重跑失败步骤，而直接 `ctx.llm.stream()` 调用仍只尝试一次。每次重试都会产生另一次提供方请求计费，always mode 会持续到成功、取消或释放。

---

## ⚡ 功能

### 适用场景

当组合运行 agent loop（智能体循环）并需要持久请求恢复时选择它。本插件是无配置的函数插件；`dsh-llm-deepseek` 与 `dsh-llm-pi-ai` 等提供方适配器拥有各自路由的 `retryPolicy`，多提供方适配器把它放进每个 provider profile。当调用不经 agent loop、直接走 `ctx.llm.stream()` 时跳过它：这些消费方仍是单次尝试，因为原始流无法持久地区分已发出的分片。

### 限制

这些限制说明执行器在哪里停止、由未来工作接续。它们是当前包约束，不是通用重试对比或任务积压。

- **agent 轮次是唯一重试边界**——直接 `ctx.llm.stream()` 消费方仍是单次尝试，因为原始流无法持久地区分已发出的分片。
- **always mode 会重试永久性失败**——认证、配额、无效请求、协议与不可恢复的上下文错误会持续到成功、取消或释放；部署方负责提供方专属的成本与延迟控制。
- **有界插件预算相加**——normal mode 只统计其配置的 code 与精确提供方策略，而上下文溢出压缩（compaction）拥有独立预算。任何重叠策略都必须定义注册顺序行为。
- **恢复策略按 waterfall 顺序组合**——always mode 先接受下游重试，再应用其回退。之后忽略取消且永不结算的策略也会阻止回退、轮次完全停稳与插件释放完成。
- **`llm/retry` 记录调度，而非完成**——后续步骤与轮次事件才确立成功、耗尽或取消。

---

## 📊 指标

### 模型请求恢复

#### 模型看到什么

重试事件、延迟、提供方错误或失败的部分输出都不会对模型可见。除非下游恢复策略刻意改变该表层，重试步骤会从持久表层历史中重建相同的显式提供方／模型请求；失败分片绝不进入派生消息。

#### Token 影响

每次重试都是一次新的提供方请求，可能重复输入 token 计费。normal mode 有有界预算；always mode 在成功或取消前可能消耗无上限请求。`llm/retry` 本身不贡献任何 token。

#### KV Cache 影响

重建的请求保留此前前缀，有资格按该提供方规则复用提供方缓存。非表层重试事件不改变缓存标识。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释执行器背后的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

执行器建立在一条规定之上：**先持久、后等待，打开步骤边界。** 任何定时器启动之前，重试就已通过会话日志计划，因此崩溃或取消永远不会留下不可见的待处理重试。恢复运行在 agent loop 的 `agent/request-error` waterfall（瀑布式事件），即打开步骤扩展点上，而不是包装 `ctx.llm.stream()`——原始流无法持久地区分已发出的分片，而 loop 可以在同一个打开的轮次内重跑失败步骤。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 函数插件：waterfall 监听器、策略查找、退避、持久事件追加 |
| [`src/types.ts`](src/types.ts) | 浏览器安全的 `llm/retry` 与 `llm/retry-started` 事件载荷类型 |
| [`src/brand.ts`](src/brand.ts) | 事件载荷共享的 `RetryId` 品牌 |

### 恢复流程

失败步骤连同其提供方与解析后的策略一起到达 waterfall。always mode 先结算下游恢复，并遵循下游的 `retry` 决定；normal mode 先检查失败 code 是否合格、预算是否未耗尽。插件计算延迟——有效且在边界内的提供方 `Retry-After`，否则带对称抖动的本地有界指数退避——追加 `llm/retry` 事件，在可取消定时器上等待，追加 `llm/retry-started`，然后返回 `{ kind: 'retry' }`。loop 随后在同一个打开的轮次内重跑失败步骤（仍基于同一份持久历史）。

### Waterfall 组合

本插件是 `agent/request-error` waterfall 中的一个监听器。always mode 的"下游优先"姿态意味着，之后忽略取消且永不结算的策略也会阻止回退、轮次完全停稳与插件释放完成；成功、取消或释放会在活动委派恢复达到完全停稳后停止 always mode。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是不具权威性的工作上下文：维护者备注与开放问题。已交付的行为与既定理由以上文、包代码和相关 Agent Note 为准。

- 重试编号只在同一提供方与完整策略键的事件间延续，因此限额、code 成员或退避不同的路由替换会开启自己的历史；该键包含每个影响行为的字段，并因资格判断使用集合成员而对 normal mode code 排序。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 函数插件：waterfall 监听器、策略查找、退避、持久事件追加 |
| [`src/types.ts`](src/types.ts) | 浏览器安全的 `llm/retry` 与 `llm/retry-started` 事件载荷类型 |
| [`src/brand.ts`](src/brand.ts) | 事件载荷共享的 `RetryId` 品牌 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从服务约定逐步进入拥有重试策略的适配器。

- [dsh-llm 服务](../llm/README.zh.md)——其适配器拥有 `retryPolicy` 的提供方无关服务。
- [llm-deepseek 适配器](../llm-deepseek/README.zh.md)——带路由级 `retryPolicy` 的提供方适配器。
- [llm-pi-ai 适配器](../llm-pi-ai/README.zh.md)——带逐 profile `retryPolicy` 的多提供方适配器。
- [LLM 流终止失败](../../../.agents/notes/implemented/architecture/2026-07-29-terminal-llm-stream-failures.zh.md)——失败如何以终止分片到达服务边界。
- [LLM 流式子系统](../../../docs/subsystems/llm-streaming.zh.md)——`StreamChunk` 协议与适配器约定（adapter contract）。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
    retryPolicy:
      mode: always
      backoff:
        initialDelayMs: 1000
        maxDelayMs: 30000
        jitterRatio: 0.2

- name: '@deepseek-ai/dsh-llm-retry'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 函数插件：waterfall 监听器、策略查找、退避、持久事件追加 |
| [`src/types.ts`](src/types.ts) | 浏览器安全的 `llm/retry` 与 `llm/retry-started` 事件载荷类型 |
| [`src/brand.ts`](src/brand.ts) | 事件载荷共享的 `RetryId` 品牌 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-llm-retry
