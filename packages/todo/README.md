---
title: "packages/todo"
tags: []
category: "todo"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

todo 组为 agent（智能体）提供可用于规划的会话级任务列表：添加任务、标记进行中、逐项完成，同一份列表跨轮次、跨重新打开的会话持续存在。它只包含一个产品包，提供 `todo_write` 工具；列表属于创建它的 agent 会话，每次更新都会整体替换。交互式宿主会从列表展示当前计划，组本身不附带任何 UI。

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
| [`tool-todo`](tool-todo/README.zh.md) | 让 agent 维护会话任务列表：规划任务、更新状态、跟踪进度 | 注册到 `ctx.tools` |

---

## 🔗 资源

- [Todo 子系统](../../docs/subsystems/todo.zh.md)——`todo/write` 事件载荷、归属规则与 `TodoItem`。
- [生成的工具目录](../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-todo)——模型接收的 `todo_write` schema。
- [生成的配置目录](../../docs/config-catalog.zh.md#deepseek-aidsh-tool-todo)——每个受支持配置字段。
- [todo_write 工具 Agent Note](../../.agents/notes/archived/feature/2026-06-29-todo-write-tool.md)——原始设计及其备选方案。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
