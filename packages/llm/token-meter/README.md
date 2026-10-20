---
title: "@deepseek-ai/dsh-token-meter"
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

使用 `ctx.tokenMeter` 估算会话当前的请求与上下文压力，或为单条消息计价。测量会回放持久会话日志，结果确定且不进行模型调用，因此压缩、占用显示与遥测可以共享同一结果。会话投影可用时，消费方可以读取 `tokenUsage`、`contextPressure` 与 `contextBreakdown`；文本和没有图片定价的路由采用近似的固定启发式规则，存在声明时应用视觉 token 定价，文件则按模型可见的句柄文本计价。只有请求 envelope 完全相同时才复用提供方报告的用量；本包不添加模型可见内容，也不在 loop 中做决策。

---

## ⚡ 功能

### 适用场景

当多个插件应该就同一种基于回放的测量达成一致时选择它——压缩规划、占用 UI 与压力检查都读取同一个 fold。测量回放持久会话日志，因此确定、无需模型调用，并精确反映已记录内容。文本和未声明图片定价的路由使用固定启发式规则；当部署需要精确到计费级别的计数时，使用提供方分词器。

### 限制

这些限制说明计量在哪里停止、由未来工作接续。它们是当前包约束，不是通用 token 计量对比或任务积压。

- **固定启发式规则是近似值**——没有可复用提供方用量的文本按字符数加结构开销计价，而非精确提供方分词器或请求序列化器；只有声明了定价的路由上的图片出现处携带提供方精确的视觉 token。
- **每次测量都克隆当前表面**——连贯不可变快照让读取为 O(surface)，包括低于阈值的压力检查。
- **提供方用量只在规范 envelope 完全相同时可复用**——工具、提供方、模型或调用配置变化会刻意回退到完整启发式估算；系统提示词变更在下一次成功调用之前按带符号的表面增量计量。
- **系统提示词改写不带影子价**——循环替换 system 节点时没有紧邻的计量事件，因此 `contextPressure.projectedTokens` 以零增量折叠该替换，直到下一个用量样本；`contextBreakdown.systemTokens` 与 `measure()` 会立即按新提示词重新计价。
- **构成检查点保留当前 surface**——精确的 system/message 分类需要位置条目；检查点大小和 surface 事件折叠成本为 O(当前保留 surface)。

---

## 📊 指标

间接地，通过 `dsh-compaction-basic` 等消费方；服务本身不添加任何提示词、消息、schema、工具或模型调用。

#### KV Cache 影响

不直接失效；任何请求前缀变更都由点名的消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释服务背后的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

服务建立在一个 fold 与一个锚点之上。每个会话都有隔离的回放状态——已消费事件游标、规范请求标头、已计价表面、步骤边界与测量锚点——通过折叠持久日志推进。只有当提供方用量的规范 envelope 匹配、且其总量不低于同一次调用的完整路由定价时，才用它锚定测量；否则会估算完整 envelope 与表面。与路由无关的 `heuristicTokens` 字段使替换影子价投影保持确定性。fold 是整体且分配全新的：格式错误事件会在任何变更前抛出，因此同一份日志每次重试都以相同方式失败。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `TokenMeter` 服务：回放状态、fold、`measure()` 与 `estimateMessage()` |
| [`src/estimate.ts`](src/estimate.ts) | 固定启发式规则：每 token 四字符加块与角色开销 |
| [`src/surface-fold.ts`](src/surface-fold.ts) | 与 `measure()` 共享的位置表面 fold |
| [`src/surface-projection.ts`](src/surface-projection.ts) | O(1) 投影单元的影价协议 |
| [`src/usage-projection.ts`](src/usage-projection.ts) | `tokenUsage` 与 `contextPressure` 投影定义 |
| [`src/breakdown-projection.ts`](src/breakdown-projection.ts) | `contextBreakdown` 投影定义 |
| [`src/client.ts`](src/client.ts) | 面向投影消费方、可安全用于浏览器的客户端接口 |
| [`src/turn-usage.ts`](src/turn-usage.ts) | 精确逐次尝试与逐 Turn 用量的纯 fold |

### Fold 流程

每次 `measure()` 调用都把 fold 同步到当前持久尾部，然后读取一份连贯快照。fold 跟踪完整请求标头快照、步骤边界、表面追加与替换、成功 assistant 消息及提供方用量。用量锚点的提供方输出从 assistant 消息的精确内嵌流重新组装，与监听器对持久内容的改写相互独立；空的重组内容计价为零。

### 投影语义

`contextBreakdown` 按 surface 顺序保留纯 JSON 的 `{ seq, heuristicTokens, system }` 条目，并复用测量服务的 plan/commit fold。其状态与 surface 转换成本为 O(当前保留 surface)，不是 O(1)，也不是 O(完整历史日志)；被替换条目和消息正文不保留。状态版本 5 使计入省略元数据的检查点失效。`contextPressure` 仍是标量影子价消费方：没有相邻 claim 的替换贡献零增量。用量 fold 保留一个最后样本槽，因为合法日志不会在更晚步骤报告用量后再次报告更早步骤的用量。

`./estimate` 导出无服务状态的文字与内容估算函数，供工具结果保留复用。图片的实际请求成本由模型适配器的 `imageRequestPricing` 提供。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是不具权威性的工作上下文：维护者备注与开放问题。已交付的行为与既定理由以上文、包代码和相关 Agent Note 为准。

- 固定每 token 四字符启发式规则会低估 CJK 文本与 JSON schema；复用用量时提供方锚点恰好携带该误差，请把构成行呈现为近似构成，绝不呈现为总量。
- 按提供方的精确分词器尚未决定；保持单一确定性启发式规则，正是让每个消费方的测量一致且回放稳定的原因。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `TokenMeter` 服务：回放状态、fold、`measure()` 与 `estimateMessage()` |
| [`src/estimate.ts`](src/estimate.ts) | 固定启发式规则：每 token 四字符加块与角色开销 |
| [`src/surface-fold.ts`](src/surface-fold.ts) | 与 `measure()` 共享的位置表面 fold |
| [`src/surface-projection.ts`](src/surface-projection.ts) | O(1) 投影单元的影价协议 |
| [`src/usage-projection.ts`](src/usage-projection.ts) | `tokenUsage` 与 `contextPressure` 投影定义 |
| [`src/breakdown-projection.ts`](src/breakdown-projection.ts) | `contextBreakdown` 投影定义 |
| [`src/client.ts`](src/client.ts) | 面向投影消费方、可安全用于浏览器的客户端接口 |
| [`src/turn-usage.ts`](src/turn-usage.ts) | 精确逐次尝试与逐 Turn 用量的纯 fold |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从计量服务逐步进入压缩消费方与共享类型。

- [Token 计量子系统](../../../docs/subsystems/token-meter.zh.md)——`ctx.tokenMeter` 背后的测量语义。
- [dsh-llm 服务](../llm/README.zh.md)——其容量元数据由 `resolveModelInfo()` 提供的模型调用服务。
- [压缩能力](../../../docs/subsystems/compaction.zh.md)——读取 `measure()` 的压力敏感消费方。
- [投影 token 用量](../../../.agents/notes/implemented/architecture/2026-07-29-projected-token-usage-and-request-context.zh.md)——`projectedTokens` 背后的设计与被否决的原子配对比较。
- [LLM 流式子系统](../../../docs/subsystems/llm-streaming.zh.md)——本服务计价的消息与块类型。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-token-meter'
- name: '@deepseek-ai/dsh-compaction-basic'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `TokenMeter` 服务：回放状态、fold、`measure()` 与 `estimateMessage()` |
| [`src/estimate.ts`](src/estimate.ts) | 固定启发式规则：每 token 四字符加块与角色开销 |
| [`src/surface-fold.ts`](src/surface-fold.ts) | 与 `measure()` 共享的位置表面 fold |
| [`src/surface-projection.ts`](src/surface-projection.ts) | O(1) 投影单元的影价协议 |
| [`src/usage-projection.ts`](src/usage-projection.ts) | `tokenUsage` 与 `contextPressure` 投影定义 |
| [`src/breakdown-projection.ts`](src/breakdown-projection.ts) | `contextBreakdown` 投影定义 |
| [`src/client.ts`](src/client.ts) | 面向投影消费方、可安全用于浏览器的客户端接口 |
| [`src/turn-usage.ts`](src/turn-usage.ts) | 精确逐次尝试与逐 Turn 用量的纯 fold |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-token-meter
