---
title: "spill/：文本 spill 能力家族"
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

`spill/` 组在模型上下文之外保存全文，并返回定位信息与取回指引。该家族拆分为 `spill/` 中的存储服务、`spill-local/` 中的本地文件系统后端，以及 `spill-policy/` 中的工具结果策略。工具结果 spill 通过 `maxInlineTokens` 按需启用，存储失败时保留原始结果。[会话引用](../context/session-reference/README.zh.md)也直接使用存储来保存已捕获但被截断的 transcript（文本记录），并自行提供预览和失败通知；它不需要工具结果策略。

---

## ⚡ 功能

「待补充」

---

## 📊 指标

「待补充」

---

## 🏛️ 设计

「待补充」

---

## 📁 目录

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`spill/`](spill/README.zh.md) | 存储服务：保存超大文本并返回定位信息与取回指引 | `ctx.spillStore` |
| [`spill-local/`](spill-local/README.zh.md) | 将 spill 文本保存到本机的私有会话级文件 | 注册到 `ctx.spillStore` |
| [`spill-policy/`](spill-policy/README.zh.md) | 用预览和定位信息替换过大的纯文本工具结果 | 监听 `ctx.tools` |

---

## 🔗 资源

先从子系统参考文档了解共享词汇，再看设计决策。

- [spill 子系统](../../docs/subsystems/spill.zh.md)——`SaveTextSpill`/`SpillRef` 词汇、归属与后端关系。
- [工具输出 spill 决策](../../.agents/notes/implemented/architecture/2026-07-08-tool-output-spill-files.zh.md)——存储、保留与工具自有输出处理之间的能力边界。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
