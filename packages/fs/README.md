---
title: "packages/fs"
tags: []
category: "fs"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`fs/` 组为 agent（智能体）提供持久、受策略约束的文件访问：`fs/` 定义 `ctx.fs` 服务约定，`fs-local/` 与 `fs-sandbox/` 提供宿主文件系统与沙箱强制后端，`fs-observation-policy/` 提供编辑前读取策略，`tool-fs/`（`read`、`read_image`、`write`、`edit`）与 `tool-fs-search/`（`glob`、`grep`）提供面向模型的工具。部署挂载一个后端，加载策略以获得新鲜度防护的变更，并注册模型应看到的工具包；后端可以更换，无需改动工具或策略。文件 I/O 有意不设超时：deadline 只会杀掉操作系统仍会完成的工作，因此取消只是系统调用边界的尽力而为信号。

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
| [`fs/`](fs/README.zh.md) | `ctx.fs` 服务约定：执行世界路径、有界文本 I/O，以及带可选版本防护的原子变更 | `ctx.fs` |
| [`fs-local/`](fs-local/README.zh.md) | 宿主文件系统后端：读取、写入并编辑本机上的真实文件 | 注册到 `ctx.fs` |
| [`fs-sandbox/`](fs-sandbox/README.zh.md) | 沙箱强制后端：按每次调用的沙箱模式约束写入与编辑，读取直接通过 | 注册到 `ctx.fs` |
| [`fs-observation-policy/`](fs-observation-policy/README.zh.md) | 编辑前读取策略：记录观测到的存在或缺失，并通过 `fs/*` 事件防护写入/编辑 | `fs/*` 监听器 |
| [`tool-fs/`](tool-fs/README.zh.md) | 面向模型的 `read`、`read_image`、`write` 与 `edit` 工具及其执行器 | 注册到 `ctx.tools` |
| [`tool-fs-search/`](tool-fs-search/README.zh.md) | 由打包 ripgrep 二进制支持的面向模型 `glob` 与 `grep` 发现工具 | 注册到 `ctx.tools` |
| [`tool-str-replace-editor/`](tool-str-replace-editor/README.zh.md) | 独立的 `str_replace_editor` 工具：基于 `ctx.fs` 的 `view`、`create`、`str_replace` 与 `insert` | 注册到 `ctx.tools` |

---

## 🔗 资源

先从子系统参考文档了解共享词汇与错误分类体系，再看塑造该家族的设计决策。

- [文件系统子系统](../../docs/subsystems/filesystem.zh.md)——目标、结果、防护、策略事件与错误分类体系。
- [跨能力族 fs 沙箱参考](../sandbox/sandbox-policy/README.zh.md)——文件系统 seam 上共享的沙箱模式围栏。
- [可移植执行世界消费方决策](../../.agents/notes/implemented/architecture/2026-07-28-portable-execution-world-consumers.zh.md)——文件系统与子进程提供方为何共享一个执行世界。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
