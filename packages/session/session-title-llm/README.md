---
title: "@deepseek-ai/dsh-session-title-llm"
tags: []
category: "session"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-session-title-llm` 在一致且固定的执行控制下执行一次准备好的辅助标题请求。每个提供方提供自己的系统指令、用户输入、源消息归因、推理选择与输出解释。本包负责解析路由、限制输入、输出与端到端时长，在整个流式处理期间保持调用方取消有效，记录模型可见的确切请求，并组装流。无效或迟到的操作结果在替换标题前被拒绝。

---

## ⚡ 功能

### 限制

这些限制定义被接受的生成形态。它们是当前包约束。

- **输出由提供方解释**——执行器返回组装后的内容块与终止结束原因，不决定接受或拒绝；各随附提供方的 README 记录其接纳策略。
- **整体输入字节上限**——它对超过 `maxInputBytes` 的准备输入直接拒绝，而不是将其截断。
- **推理由提供方选择**——执行器只应用提供方返回的强度，绝不自行选择；选择器返回 `undefined` 时使用路由的正常默认值。

---

## 📊 指标

### 辅助标题请求

#### 模型看到什么

标题模型会收到由提供方拥有的系统指令，以及一条包含提供方所拥有输入的用户消息。执行器记录并分发这些确切取值，不做重建；封装方式与输出指令都归提供方所有，并由[首消息](../session-title-first-prompt-llm/README.zh.md)与[全消息](../../experimental/session-title-all-prompts-llm/README.zh.md) README 记录。

#### Token 影响

辅助请求根据提供方准备好的输入大小与 `maxOutputTokens` 消耗 token。它与主 agent 请求相互独立，不会向 agent 历史增加标题文本或封装内容。执行器应用提供方选定的推理强度；选择器返回 `undefined` 时使用路由的正常默认值。仍在推理的模型会把部分 `maxOutputTokens` 用于推理。主对话保留自身配置的思考模式。

#### KV Cache 影响

不会使主请求的 KV Cache 失效。辅助缓存复用由提供方决定：此执行器分发提供方确切的系统提示词与输入，因此复用取决于各提供方对各次修订的封装方式。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释生成路径；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

一份小型共享执行策略，使操作行为无法漂移：执行控制校验、路由解析、预算执行、取消、请求记录与流式组装都在这里。提示词措辞、标题长度目标、推理选择与输出解释仍归各提供方所有。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 配置 schema 与校验、路由解析、请求上限、分发、记录与流式组装 |

### 请求流程

调用方构建准备好的输入并进行封装；函数依据 `maxInputBytes` 检查完整输入。提供方的推理选择器在 `ctx.llm.prepareCall()` 期间最多选择一个强度。函数把确切输入、输出上限与解析后的强度记录到 `session/title-llm-request`，然后在共享截止时间内通过同一捕获的适配器代次分发。`purpose: 'session-title'` 仅提供归属标注。请求不带 agent loop 身份，也不进入对话历史。生成失败仍保留请求记录。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 配置 schema 与校验、路由解析、请求上限、分发、记录与流式组装 |

---

## 🔗 资源

当生成策略不够用时阅读以下页面。它们从它所插入的服务逐步进入消费它的提供方插件。

- [会话标题服务](../session-title/README.zh.md)——标题服务、回退行为与提供方注册约定。
- [会话标题子系统](../../../docs/subsystems/session-title.zh.md)——持久标题状态与辅助请求记录。
- [首消息标题提供方](../session-title-first-prompt-llm/README.zh.md)——根据第一条符合条件的用户消息生成标题。
- [全消息标题提供方](../../experimental/session-title-all-prompts-llm/README.zh.md)——根据所有符合条件的用户消息生成标题。
- [会话包映射](../README.zh.md)——相邻的持久化、投影、标题与遥测包。

---

## 🚀 快速开始

执行提供方请求

提供方插件直接注册到 `ctx.sessionTitle`，并在其 `generate(request)` 中把 `{ system, input, messageSeqs, selectReasoningEffort }` 传给 `executeSessionTitleLlm`。提供方负责系统指令、输入封装、自己的推理选择与输出解释；该函数负责路由准备、上限、取消、请求记录与流式组装。服务上的第二次注册会立即抛出。

每个请求都带有 `currentTitle`，即服务在调用时捕获的最新已接纳标题快照，包括已接纳的回退标题。提供方自行决定是否使用它：全消息提供方只锚定来源为提供方的标题（包括继承自不同提供方的标题），并把回退、用户与不存在的标题视为初始生成。首消息提供方忽略 `currentTitle`。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-title-llm
