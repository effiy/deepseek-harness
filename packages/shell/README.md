---
title: "shell/ — bash 能力家族"
tags: []
category: "shell"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

shell 组为 agent（智能体）提供命令执行能力：运行前台命令并读取其有界输出，或启动后台进程并轮询它——在 POSIX 上用 Bash，在 Windows 上用 PowerShell。每个组合恰好挂载一个执行器实现；沙箱执行器会通过沙箱能力限制每条命令，面向模型的 `bash` 与 `pwsh` 工具则位于所挂载执行器之上。POSIX 选择 Bash 执行器，Windows 选择 PowerShell 执行器；命令需要文件级隔离时选择沙箱变体。

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
| [`shell`](shell/README.zh.md) | 定义执行器约定：前台运行、后台句柄与请求解析 | `ctx.shell` |
| [`bash-local`](bash-local/README.zh.md) | 在 POSIX 上以全新 `bash -c` 进程运行 Bash 命令 | 注册 `ctx.shell` |
| [`bash-sandbox`](bash-sandbox/README.zh.md) | 通过沙箱能力限制 Bash 命令运行，并把拒绝报告为事实 | 注册 `ctx.shell` |
| [`pwsh-local`](pwsh-local/README.zh.md) | 在 Windows 上以全新 `pwsh -Command` 进程运行 PowerShell 命令 | 注册 `ctx.shell` |
| [`pwsh-sandbox`](pwsh-sandbox/README.zh.md) | 通过沙箱能力限制 PowerShell 命令运行 | 注册 `ctx.shell` |
| [`shell-env`](shell-env/README.zh.md) | 提供每条 shell 命令都会收到的受管 `DSH_*` 环境 | `ctx.shellEnv` |
| [`tool-bash`](tool-bash/README.zh.md) | 以 `bash` 工具向模型公开 Bash 执行与后台任务 | 注册到 `ctx.tools` |
| [`tool-bash-persistent`](tool-bash-persistent/README.zh.md) | 在单个限定所有者范围的持久 Bash 会话中运行模型的 shell 调用 | 注册到 `ctx.tools` |
| [`tool-pwsh`](tool-pwsh/README.zh.md) | 以 `pwsh` 工具向模型公开 PowerShell 执行 | 注册到 `ctx.tools` |
| [`tool-pwsh-persistent`](tool-pwsh-persistent/README.zh.md) | 在单个限定所有者范围的持久 PowerShell 会话中运行模型的 shell 调用 | 注册到 `ctx.tools` |

---

## 🔗 资源

- [Bash 执行器子系统](../../docs/subsystems/shell.zh.md) —— 共享的请求/spec 词汇、结果、后台进程与完整的服务约定。
- [沙箱子系统](../../docs/subsystems/sandbox.zh.md) —— 沙箱执行器所消费的隔离能力。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
