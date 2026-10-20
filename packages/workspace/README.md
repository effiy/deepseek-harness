---
title: "packages/workspace"
tags: []
category: "workspace"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

workspace 家族让宿主产品持久保存命名且有序的项目列表，并按目录归组每个项目的会话。用户可以浏览这些项目与会话、将会话从分组中隐藏而不删除该会话，以及移除项目而不删除其文件夹或会话历史。被隐藏或从项目中移除的会话仍可作为未分组的历史记录使用。需要持久项目界面时选用此家族；它需要会话存储和持久化后端，且不会向模型公开工具、提示词或会话事件。

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
| [`workspace`](workspace/README.zh.md) | 提供命名且有序的项目，并按目录归组在其中运行的会话 | `ctx.workspaceRegistry` |

---

## 🔗 资源

- [Workspace 子系统](../../docs/subsystems/workspace.zh.md)——项目及其会话的权威功能约定。
- [领域 KV 存储 Agent Note](../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.zh.md)——项目记录背后的存储设计。
- [Workspace UI 产品流 Agent Note](../../.agents/notes/archived/feature/2026-07-25-workspace-ui-product-flow.md)——首次启动如何从会话历史构建项目，以及 GUI 如何排序。
- [历史删除 Workspace 注册记录决策](../../.agents/notes/archived/feature/2026-07-27-workspace-registration-deletion.md)——为什么移除项目绝不会删除其文件夹或会话。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
