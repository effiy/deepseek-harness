---
title: "@deepseek-ai/dsh-llm-mock-server"
tags: []
category: "test-support"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

本包为测试与演示提供可编脚本的 Messages 兼容 HTTP／SSE（Server-Sent Events）端点，并为原生 SDK 消费方发送具名事件，使其无需提供方密钥即可检验模型提供方的失败与成功。每个已接受的 `/v1/messages` 请求依次消费下一个脚本行为，包括重置、停滞、畸形分片、限流、服务器错误、补全与工具调用。测试作者可以通过 `pnpm run mock:llm` 运行服务器，也可以调用 `startMockLlmServer`，后者会返回捕获的请求供断言使用。带种子的 `random` 行为支持可复现的混合故障压力运行。

---

## ⚡ 功能

### 限制

这些限制说明何时需要对该服务器特别小心。它们是当前包约束，不是任务积压。

- **随机权重建模测试压力，而非生产事故频率**——需要环境专用分布的调用方必须提供已测量权重，并记录发出的种子。
- **请求脚本按到达顺序执行**——并发调用方共享一个游标，因此确定性的每会话故障分配需要独立服务器实例。
- **真实连接拒绝发生在监听器生命周期阶段**——CLI 延迟必须与客户端尝试重叠；请求级随机选择只能重置已接受的连接。

---

## 📊 指标

无。该测试服务器替代提供方协议行为，而不调用真实模型。

#### KV Cache 影响

无；请求在本地终止，绝不会到达提供方缓存。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释服务器的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计

服务器建立在一个规则之上：每个已接受的 Messages 请求从按到达顺序排列的 FIFO 游标消费恰好一个行为，服务器从不重试或解读 harness 策略。校验先于游标推进——只有 `POST` 且路径以 `/v1/messages` 结尾、配置密钥时携带有效 API key、且 JSON 正文可解析的请求才消费脚本；其余请求都收到普通 4xx。`random` 条目在请求时通过带种子的 PRNG 按配置权重解析，因此一次运行可由其打印出的种子复现。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `startMockLlmServer`：listener、行为表、种子随机、遥测（telemetry）、捕获的请求记录 |
| [`src/cli.ts`](src/cli.ts) | `--sequence` 与时序/内容选项解析、JSONL stdout 遥测 |
| [`src/bin.ts`](src/bin.ts) | `pnpm run mock:llm` 源入口 |

### 协议流程

请求进入处理器、通过校验，然后选择行为：具体脚本条目直接运行，`random` 抽取一个，已耗尽脚本则以结构化 500 报告 `script_exhausted`。随后 `runBehavior` 执行协议结果——销毁 socket、SSE 流、JSON 错误或补全——同时每个请求与结果按到达顺序记录到返回的句柄上，供测试断言。`close()` 停止接受请求并强制终止停滞连接。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `startMockLlmServer`：listener、行为表、种子随机、遥测（telemetry）、捕获的请求记录 |
| [`src/cli.ts`](src/cli.ts) | `--sequence` 与时序/内容选项解析、JSONL stdout 遥测 |
| [`src/bin.ts`](src/bin.ts) | `pnpm run mock:llm` 源入口 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从故障服务器逐步进入它所检验的适配器约定，以及用于已记录成功 transcript（文本记录）的无密钥替代方案。

- [LLM 包](../../llm/llm/README.zh.md)——本服务器所检验的提供方流约定与重试策略。
- [llm-replay](../llm-replay/README.zh.md)——回放已记录成功 transcript 而非制造故障的无密钥替代方案。
- [测试策略](../../../docs/testing.zh.md)——本服务器服务的覆盖层级与恢复测试。
- [test-support 组地图](../README.zh.md)——兄弟 harness 与支持包。

---

## 🚀 快速开始

独立运行

从本仓库运行源入口：



将发布的 DeepSeek 适配器指向服务器；它会向服务器 `/v1` 根路径下的 `/messages` 发送请求：



仓库脚本将 JSONL 写入 stdout：`ready` 记录携带以 `/v1` 结尾的 base URL 与随机种子，后续请求/结果记录同时命名脚本行为与实际选中的具体行为。本包不公开可安装的二进制命令。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-llm-mock-server
