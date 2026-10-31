---
title: "interaction/：人机协作平面"
tags: []
category: "interaction"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`interaction/` 组覆盖用户引导运行中 agent 的各种方式。斜杠命令适合无需模型往返的即时操作；一次性审批用于敏感操作；权限预设可以同时选择沙箱与审批行为；当 agent 需要信息或决定时，它还可以向用户提问。交互式应用向用户提供这些能力；自动化则通过 ACP（Agent Client Protocol）处理自己的审批。下方包映射说明了每项能力的区别，并链接其完整行为与配置。

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

| 包 | 角色 | ctx 键 |
|---|---|---|
| [`commands/`](commands/README.zh.md) | 让用户输入斜杠命令，直接针对 agent 执行，无需模型往返 | `ctx.commands` |
| [`user-approval/`](user-approval/README.zh.md) | 向组合后的应答者征求一次性允许／拒绝决定；若未获得决定，则默认拒绝 | `ctx.approval` |
| [`permission-presets/`](permission-presets/README.zh.md) | 把沙箱模式与审批策略捆绑为一个面向用户的权限选择器 | `ctx.permissionPresets` |
| [`user-questions/`](user-questions/README.zh.md) | 定义经过校验的问题 schema 与作用域 answerer waterfall，agent 可暂停等待 | `ctx.userQuestions` |
| [`tool-ask-user/`](tool-ask-user/README.zh.md) | 暴露 `ask_user_question` 工具，让模型可以向用户提问并请求其作出决定 | 注册到 `ctx.tools` |

---

## 🔗 资源

先从子系统参考了解共享词汇，再看相邻的自动化与组合面。

- [命令子系统](../../docs/subsystems/commands.zh.md)——命令注册表语义与 `ctx.commands` 的 Cordis 接口面。
- [审批子系统](../../docs/subsystems/approval.zh.md)——请求／结果词汇、应答者瀑布与按会话策略。
- [权限预设子系统](../../docs/subsystems/permission-presets.zh.md)——预设表与旋钮写穿。
- [用户交互子系统](../../docs/subsystems/user-questions.zh.md)——问题词汇、answerer waterfall 与待处理问题生命周期。
- [ACP 组](../acp/README.zh.md)——仅自动化的传输，为其自有 agent 回答审批请求。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
