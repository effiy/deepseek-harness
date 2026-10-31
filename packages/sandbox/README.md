---
title: "packages/sandbox"
tags: []
category: "sandbox"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`sandbox/` 组将子进程执行限制在文件效果策略之下：命令以 `read-only` 运行、只能写入会话工作区（`workspace-write`）或不受限制地运行（`danger-full-access`）。四个包交付该能力：隔离服务（`sandbox/`）、面向 Linux、macOS 与 Windows 的各平台后端（`sandbox-local/`）、共享策略解析器（`sandbox-policy/`）与 Windows 写入限制后端（`sandbox-windows-acl/`）。被策略拒绝的受限调用可以通过用户批准的一次性升权重试。隔离仅适用于与宿主共享文件系统和内核的子进程；容器、microVM 与远程执行器会替换整个能力，而不是在此注册。

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
| [`sandbox/`](sandbox/README.zh.md) | 隔离服务约定：模式、强制执行、逐调用策略与升权词汇 | `ctx.sandbox` |
| [`sandbox-local/`](sandbox-local/README.zh.md) | 各平台隔离后端：Linux 先使用 bwrap，再使用 Landlock；macOS 使用 Seatbelt；Windows 使用受限令牌 | 注册到 `ctx.sandbox` |
| [`sandbox-policy/`](sandbox-policy/README.zh.md) | 共享策略归属：供所有实施隔离的家族使用的部署默认值与逐会话模式覆盖 | `ctx.sandboxPolicy` |
| [`sandbox-windows-acl/`](sandbox-windows-acl/README.zh.md) | Windows 写入限制：受限子进程只能写入工作区与私有临时目录 | —（由 `sandbox-local` 挂载为 win32 后端） |

---

## 🔗 资源

先从子系统参考文档了解共享词汇，再看隔离决策及其跨家族扩展。

- [进程沙箱子系统](../../docs/subsystems/sandbox.zh.md)——模式、逐调用策略、包装 argv 方言与故障关闭错误。
- [历史子进程沙箱决策](../../.agents/notes/archived/feature/2026-07-06-sandbox.md)——能力边界、升权编排与延期阶段。
- [跨家族文件沙箱参考](../fs/fs-sandbox/README.zh.md)——统一的共享策略归属与沙箱化文件系统提供方。
- [Windows ACL 受限令牌沙箱决策](../../.agents/notes/implemented/feature/2026-08-08-windows-acl-restricted-token-sandbox.zh.md)——为何选择原始 ACL 受限令牌而非 mxc 与 AppContainer。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
