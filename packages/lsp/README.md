---
title: "lsp/：语言服务器代码导航"
tags: []
category: "lsp"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

lsp 组让 agent（智能体）通过配置好的语言服务器导航代码：转到定义、查找引用与实现，以及阅读悬停文档。使用 `lsp-stdio` 连接本地 stdio 语言服务器命令和扩展名映射，使用 `tool-lsp` 向模型提供这些操作。共享的 `lsp` 包使提供方选择和规范化结果保持一致，因此更换服务器不会改变模型请求。部署必须自行提供并配置语言服务器；本组不随附任何语言服务器。

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

| 包 | 职责 | ctx key |
|---|---|---|
| [`lsp/`](lsp/README.zh.md) | 定义代码导航服务：按文件扩展名选择提供方、四种规范化的只读操作与结构化错误 | `ctx.lsp` |
| [`lsp-stdio/`](lsp-stdio/README.zh.md) | 通过 `ctx.fs` 与 `ctx.subprocess` 驱动配置好的 stdio 语言服务器命令，注册为提供方 | 注册到 `ctx.lsp` |
| [`tool-lsp/`](tool-lsp/README.zh.md) | 通过 `lsp` 工具向模型暴露精确的代码导航 | 注册到 `ctx.tools` |

---

## 🔗 资源

- [LSP 导航子系统](../../docs/subsystems/lsp.zh.md)——操作、坐标、请求与结果，以及 `LspError` 错误码。
- [生成的工具目录](../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-lsp)——模型接收的 `lsp` schema。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
