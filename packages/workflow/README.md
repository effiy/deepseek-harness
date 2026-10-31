---
title: "packages/workflow"
tags: []
category: "workflow"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

workflow 组让 agent（智能体）可以运行编排脚本，将工作委派给 subagent 并返回最终值。`workflow` 工具支持脚本化扇出。脚本使用共享 PTC Node 进程运行时，遵守调用 Session 的文件策略。工作流钩子和子 agent 生命周期仍由工作流引擎负责。

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
| [`workflow`](workflow/README.zh.md) | 运行由模型编写的、扇出 subagent 的编排脚本 | `ctx.workflowEngine` |
| [`workflow-ptc`](workflow-ptc/README.zh.md) | 通过共享的沙箱化 PTC Node 进程运行时执行工作流脚本 | 注册到 `ctx.workflowEngine` |
| [`tool-workflow`](tool-workflow/README.zh.md) | 把 `workflow` 工具交给模型，用于脚本化多 agent 编排 | 注册到 `ctx.tools` |

---

## 🔗 资源

- [工作流子系统](../../docs/subsystems/workflow.zh.md)——seam 的类型、启动请求与 `workflow/*` 事件。
- [生成的工具目录](../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-workflow)——模型接收的 `workflow` 工具 schema。
- [生成的工具目录](../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-ralph)——模型接收的 `ralph` 工具 schema。
- [生成的配置目录](../../docs/config-catalog.zh.md#deepseek-aidsh-workflow-ptc)——每个受支持的引擎配置字段。
- [历史动态工作流 Agent Note](../../.agents/notes/archived/feature/2026-07-05-dynamic-workflows.md)——seam 设计及其决策。
- [Harness 层目标式执行 参考](../experimental/tool-ralph/README.zh.md)——固定全新 agent 循环的设计与暂缓事项。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
