---
title: "ssh/ — POSIX 远端执行提供方"
tags: []
category: "ssh"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

本家族将文件、普通进程、终端及沙箱执行放在同一台 POSIX SSH 主机上，Harness 保留在本地。共享 OpenSSH 连接与已安装辅助程序支持现有文件系统、子进程及沙箱接口。适用于消费方遵守提供方路径语义的 headless 或自定义配置组合。

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

| 包 | 职责 | 服务 |
|---|---|---|
| [`ssh`](ssh/README.zh.md) | 连接、辅助程序身份及传输生命周期 | `ctx.ssh` |
| [`ssh-helper-runtime`](ssh-helper-runtime/README.zh.md) | 无须安装 Node 的私有可执行文件发行包 | — |
| [`fs-ssh`](fs-ssh/README.zh.md) | 远端文件身份、读取及带保护的原子修改 | `ctx.fs` |
| [`subprocess-ssh`](subprocess-ssh/README.zh.md) | 可执行文件查找、进程、控制流及终端 | `ctx.subprocess` |
| [`sandbox-ssh`](sandbox-ssh/README.zh.md) | 远端文件效果限制及执行信息 | `ctx.sandbox` |

---

## 🔗 资源

- [SSH 子系统](../../docs/subsystems/ssh.zh.md) — 共享执行坐标及传输归属。
- [POSIX SSH 决策](../../.agents/notes/implemented/architecture/2026-09-11-posix-ssh-runtime.zh.md) — 替代方案、影响及验证要求。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
