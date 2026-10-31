---
title: "skill/ — skill 能力家族"
tags: []
category: "skill"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

skill 家族让 agent 和用户仅在需要时发现并加载可复用的任务指令。使用 `skill/` 合并目录并为每个名称提供一组指令；需要从项目、自定义或用户目录发现 skill 时选择 `skill-filesystem`，需要 Word、PowerPoint 和 Excel 工作流时选择 `skill-office`。需要让模型获得排序且持久的会话目录、通过 `skill` 工具加载完整指令，或接受 `/name` 直接调用时，请添加 `tool-skill`。不同来源生成相同的模型可见格式，启用模型访问前必须配置至少一个来源。

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
| [`skill/`](skill/README.zh.md) | 合并任意提供方的 skill 目录、并按名称解析出胜出 skill 的注册表 | `ctx.skills` |
| [`skill-filesystem/`](skill-filesystem/README.zh.md) | 从项目、自定义与用户目录发现 skill，并监视其变更 | 注册到 `ctx.skills` |
| [`skill-office/`](skill-office/README.zh.md) | 随包提供 Word、PowerPoint 和 Excel 工作流及文件结构检查 | 注册到 `ctx.skills` |
| [`tool-skill/`](tool-skill/README.zh.md) | 发布会话 skill 目录与面向模型的 `skill` 加载工具 | 注册到 `ctx.tools` |
| [`tool-workspace-dependencies/`](tool-workspace-dependencies/README.zh.md) | 为 Desktop 与 SDK 载体报告内置 Office 解释器路径和版本 | 注册到 `ctx.tools` |

---

## 🔗 资源

先从子系统参考了解共享词汇，再阅读 Agent Note 了解设计依据。

- [skill 子系统参考](../../docs/subsystems/skills.zh.md)——注册表、提供方约定、本地发现优先级，以及目录与工具。
- [skill 调用策略 参考](skill/README.zh.md)——模型与用户调用控制。

-----

实验性可选能力见 [`skill-badge`](../experimental/skill-badge/README.zh.md)。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
