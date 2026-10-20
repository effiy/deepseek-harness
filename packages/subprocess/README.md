---
title: "subprocess/：子进程能力家族"
tags: []
category: "subprocess"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

harness 运行的每个子进程与终端会话——bash 命令、语言服务器、持久 shell 与进程外 subagent 后端——都经由一个共享服务（`ctx.subprocess`）启动、观察与终止，并由一个本地提供方在宿主机器上执行。它不是独立的产品功能：消费方能力 seam 决定每个进程的含义，命令语义、时限与面向模型的呈现仍归它们所有。本组提供可执行文件查找、带 spill 恢复的有界输出捕获、由提供方管理且明确披露较弱 fallback 的进程范围，以及每个子进程起步时所用的清理后环境。

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
| [`subprocess`](subprocess/README.zh.md) | 定义子进程服务：可执行文件查找、受管进程 spawn 与真实终端会话 | `ctx.subprocess` |
| [`subprocess-local`](subprocess-local/README.zh.md) | 在支持的平台上以原生受管范围运行宿主进程与终端，其他平台使用明确披露的较弱 fallback | 注册到 `ctx.subprocess` |
| [`win32-process`](win32-process/README.zh.md) | 负责维护 sandbox 与普通进程创建、stdio、Job 分配、轮询、等待与句柄清理所用的共享 Win32 绑定 | 库，不使用 ctx key |

---

## 🔗 资源

- [子进程子系统](../../docs/subsystems/subprocess.zh.md)——spawn spec、输出读取器、结果与受管的 `DSH_*` 环境。
- [subprocess seam Agent Note](../../.agents/notes/archived/architecture/2026-07-26-subprocess-seam.md)——bash 执行器的进程部分为何成为独立的 seam。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
