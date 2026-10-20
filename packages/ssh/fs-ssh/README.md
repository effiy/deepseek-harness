---
title: "@deepseek-ai/dsh-fs-ssh"
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

`dsh-fs-ssh` 在 SSH 辅助进程的文件系统中提供 `ctx.fs`。文件工具读写的文件与远端 Bash、终端、语言服务器和 Node 程序看到的文件一致。远端路径规范化、版本保护及原子修改使用辅助程序旁安装的本地文件系统实现。

---

## ⚡ 功能

### 限制

- 辅助程序将整段文本读取及单次字节窗口限制为 8 MiB。更大的读取需使用文本流或多个字节窗口；其他 JSON 传输也受连接消息大小上限约束。
- 不支持文件系统监听：提供方不覆写 `watch()`，由基类以 `FS_IO_ERROR` 拒绝；不使用轮询，也不为远程路径建立本地监听。普通读取与消费方提供的手动刷新仍可用。
- 远端文件 URL 是执行坐标，不是主机文件系统句柄或 Web 下载链接。

---

## 📊 指标

间接通过现有文件系统消费方产生影响，由它们展示远端路径及文件内容，并负责每个工具与提示。

#### KV Cache 影响

本提供方不贡献请求前缀内容。面向模型的工具与结果由消费方负责。

## 已知限制与延后工作

---

## 🏛️ 设计

<details>
<summary>实现细节 — 点击展开</summary>

辅助程序复用 [`fs-local`](../../fs/fs-local/README.zh.md) 与 [`fs-sandbox`](../../fs/fs-sandbox/README.zh.md)，保留符号链接身份、陈旧版本拒绝、差异基线及发布语义。UTF-8 流使用有界拉取请求，在消费方提前停止时关闭远端迭代器。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [文件系统子系统](../../../docs/subsystems/filesystem.zh.md) — 共享操作及错误含义。
- [SSH 连接](../ssh/README.zh.md) — 部署与断连行为。

---

## 🚀 快速开始

将本提供方与 [`dsh-ssh`](../ssh/README.zh.md) 及 `sandboxPolicy` 一同挂载，并使用配套 SSH 子进程与沙箱提供方执行程序。本提供方没有配置字段：连接身份和默认工作区属于 `dsh-ssh`，文件效果模式属于 `sandboxPolicy`。

`resolve()` 在远端主机上规范化路径。`processPath()` 与 `fileUrl()` 在同一个远端命名空间中标识文件，并不授予主机侧访问能力。文件 URL 对字面的百分号、反斜杠和换行进行编码，保留原文件名。`processPathFromHostPath()` 返回 `undef

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-fs-ssh
