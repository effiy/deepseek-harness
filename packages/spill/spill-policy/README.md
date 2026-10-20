---
title: "@deepseek-ai/dsh-spill-policy"
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

将过大的文字和图片结果限制在共享的估算 token 预算内。模型收到按原顺序保留的首尾内容，以及完整结果文件的路径。图片保存在附件存储中，结果文件记录其可读取路径。省略 `maxInlineTokens` 会禁用策略，无法保存可恢复内容时保留原结果。

---

## ⚡ 功能

### 限制

这些限制说明策略在哪些情况下无法提供帮助。它们是当前的包约束。

- **文本识别无法认证输出来源**——工具也能打印相同的通知文本；`hasSpillNotice` 识别的是文本约定，不能证明策略保存过结果。
- **无法恢复或计量**：图片要求模型计算器和执行环境可读取的附件路径，否则保留原内容。不支持的内容块、被阻止的反馈和 `read` 也会原样通过。
- **通知无法容纳时会禁用该次调用的替换**——上限极小或定位信息很长时，后端已经保存了无引用的 spill，但过大的原始结果仍留在内联位置。

---

## 📊 指标

### 过大的文字和图片结果

#### 模型看到什么

保留的前缀和后缀维持图片顺序，并在省略区间显示 `[...]`。末尾提示说明省略的文字字节数、整张图片数量及完整结果路径。读取该文件可以找到省略的文字和图片地址。

#### Token 影响

成功替换的结果在共享文字估算和当前模型图片计算器下不超过 `maxInlineTokens`，包括提示和图片说明文字。实际用量以提供方报告为准。

#### KV Cache 影响

仅追加；新可见内容位于可重用请求前缀之后，不会使现有 KV Cache 条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释该策略背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

纯保留函数按成本选择有序内容，插件负责策略、读取提示和存储调用。文字使用现有 token-meter 估算。图片使用当前模型的 `imageRequestPricing`，并计入说明文字。DeepSeek 模型复用提供方的图片尺寸计算器。预算是估算值，不保证与实际分词结果完全一致。

### 两条分支

以 prepend 注册的 `tools/post-execute` 监听器先委托，再限制已接受的内容。`tools/ptc-dispatch-log` 共用同一辅助函数。MCP 的 `projectContent` 在这些策略之前安装真实图片块；后续内容替换、值替换或阻止仍然生效。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放方向。它明确不具权威性。

#### 未来：逐工具配置

逐工具选择退出或逐工具策略声明仍然延期；内置的 `read` 跳过已覆盖已知循环，第二个真实工具需求才能证明配置的合理性。

#### 未来：更早的 spill

策略只处理最终已接受的内容。此前的提供方截断和工具自身的输出限制仍由各自负责。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

当包级约定不够用时阅读以下页面。

- [spill 存储服务](../spill/README.zh.md)——策略替换背后的 `saveText` 约定。
- [dsh-spill-local](../spill-local/README.zh.md)——保存 spill 文本的本地后端。
- [Token meter](../../llm/token-meter/README.zh.md) — 共享文字估算和模型图片计量。
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

| 字段 | 默认值 | 含义 |
|---|---|---|
| `maxInlineTokens` | 省略 | 保留的文字、图片、图片说明和提示的估算 token 上限；省略时禁用策略 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-spill-policy
