---
title: "@deepseek-ai/dsh-ssh-helper-runtime"
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

远端机器无须安装 Node 或 npm 包即可运行 SSH helper。每个发行包都包含可执行文件、原生资源和完整性元数据。这个私有载体通过既有 SSH 提供方支持托管进程、终端、沙箱和内嵌 PTC worker。项目命令仍使用远端机器自身的开发工具。

---

## ⚡ 功能

### 限制

- 构建目标不包含 Windows 和基于 musl 的 Linux。沙箱可用性仍取决于目标内核和系统工具。
- 自动下载、部署、更新和连接 UI 独立于发行包生产。
- 可执行文件接受私有 worker 调用，不接受任意 Node CLI 参数。项目中的 `node` 命令和嵌套 JavaScript 子进程需要单独安装 Node。

---

## 📊 指标

None，因为这个私有进程载体不注册面向模型的工具或提示内容，操作结果由其消费方负责。

#### KV Cache 影响

载体不添加请求前缀内容。

## 已知限制与延后工作

---

## 🏛️ 设计

<details>
<summary>实现细节 — 点击展开</summary>

载体通过仓库带补丁的 `pkg --sea` 流程内嵌完整依赖集合。入口分派 SSH helper、托管子进程启动器或 PTC worker。共享的[部署函数](../../../scripts/executable-packaging.ts) 也用于 Python SDK 构建器。生产部署会在调用构建工具前恢复开发依赖安装状态，避免 pnpm 的自动依赖检查将它们删除。

操作系统必须从真实文件执行 Landlock 和 PTY 启动器。进程内的解析钩子将 system 包指向随包分发的原生目录；node-pty 使用其既有的相对可执行文件定位 spawn-helper 的约定。二进制检查在打包前覆盖内嵌原生模块，并在发布前覆盖外部资源。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [SSH 连接](../ssh/README.zh.md) — 鉴权、启动与生命周期。
- [PTC Node 运行时](../../ptc-runtime/ptc-runtime-node/README.zh.md) — 显式 worker 启动与执行限制。
- [SSH 子系统](../../../docs/subsystems/ssh.zh.md) — 远端执行坐标。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-ssh-helper-runtime
