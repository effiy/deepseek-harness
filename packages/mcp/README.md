---
title: "MCP — 模型上下文协议"
tags: []
category: "mcp"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`mcp/` 组让模型调用外部 Model Context Protocol（MCP）工具并读取服务器资源。只需配置 `mcp-client` 条目；随附 profile 已统一挂载 `mcp-resources` 一次。只有作用域中存在已配置服务器的调用方才会看到 MCP 工具与提示词文本。连接还会提供服务器指令。配置与限制由各包的 README 说明。

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

| 包 | 提供的能力 |
|---|---|
| [`mcp-client/`](mcp-client/README.zh.md) | 连接一台 MCP 服务器，暴露其工具与指令，并提供其资源操作 |
| [`mcp-resources/`](mcp-resources/README.zh.md) | 通过显式选择服务器的共享工具发现和读取资源 |

---

## 🔗 资源

先用可运行的示例配置体验插件，再阅读 Agent Note 了解其背后的行为决策。

- [历史MCP 客户端插件 Agent Note](../../.agents/notes/archived/feature/2026-07-07-mcp-client-plugin.md)——桥接的设计：服务器限定命名、发现、执行与环境清洗。
- [资源与指令 参考](mcp-resources/README.zh.md)——按需资源访问与作用域服务器指引。
- [第三方记忆 MCP 指南](../../docs/user/guide/mcp-memory.zh.md)——可运行的 overlay 配置行与设置说明。
- [工具子系统参考](../../docs/subsystems/tools.zh.md)——接收已注册工具的 `ToolRuntime`。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
