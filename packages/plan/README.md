---
title: "plan/：plan 协作状态"
tags: []
category: "plan"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`plan/` 组提供计划模式：激活期间，agent 先探索和设计再执行，遵循部署写入的指令，并在执行前提交完成的计划供你批准。你可以用 `/plan` 命令进入和离开计划模式，批准计划，或让 agent 回去继续规划。计划模式是引导而非限制：每个工具仍然可用，沙箱模式与审批提示等限制需另行配置。该组只包含一个包 `plan-mode`。

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
| [`plan-mode/`](plan-mode/README.zh.md) | 提供计划模式：`/plan` 进入和离开，部署写入的指令在规划期间引导 agent，`exit_plan_mode` 把完成的计划呈交你评审 | `ctx.planMode` |

---

## 🔗 资源

先从子系统参考了解共享词汇，再阅读设计说明了解决策。

- [计划模式子系统参考](../../docs/subsystems/plan.zh.md)——计划模式如何工作、其配置与退出工具的行为。
- [plan 专用协作状态](plan-mode/README.zh.md)——计划模式背后的设计决策。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
