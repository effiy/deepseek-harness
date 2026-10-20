---
title: "@deepseek-ai/dsh-ssh"
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

`dsh-ssh` 将 POSIX Harness 主机连接到 POSIX SSH 主机上已安装的辅助程序。部署方持有的 OpenSSH 主机别名提供认证与主机身份；配套的文件系统、子进程和沙箱提供方共享该连接。连接在就绪前验证已安装产物的摘要；辅助程序在连接关闭或租期到期时负责远端清理。

---

## ⚡ 功能

### 限制

- 不提供 Windows 端点、自动配置远端环境、重连或重放。
- Web 工作区界面的路径仍假定可访问主机文件系统；请使用 headless 或所有消费方都遵守提供方路径语义的自定义组合。
- TLS 流密钥不防御远端操作系统级进程内存检查或调试。文件效果策略保留所选沙箱后端的限制。

---

## 📊 指标

无，因为主机别名、认证与流能力令牌属于私有部署细节，每项面向模型的操作均由消费方负责。

#### KV Cache 影响

本提供方不贡献请求前缀内容。面向模型的工具与结果由消费方负责。

## 已知限制与延后工作

---

## 🏛️ 设计

<details>
<summary>实现细节 — 点击展开</summary>

OpenSSH 主连接承载私有管理 RPC。每条程序流使用独立转发的 Unix 套接字和独立 SSH 通道。程序 stdout 无法伪造管理回复，也不会占用控制流的通道窗口；SSH 传输拥塞仍会影响共享连接。

每个流预留项都有一个随机 256 位 TLS 预共享密钥，仅由管理 RPC 传递。TLS 认证两端并保护流中的每个字节；密钥绝不作为流前缀发送。套接字目录为私有目录（`0700`），套接字使用 `0600` 权限。替换可写套接字路径无法冒充端点或获知流密钥；攻击者仍可中断服务或转发不透明的 TLS 记录。

连接释放会先等待转发与取消子进程，以及尚在建立的流结束，再删除本地资源。传输丢失会拒绝待处理操作并使连接失效。辅助进程在 SSH EOF、终止信号或心跳到期时启动托管清理。断连客户端无法确认远端结果；操作不会自动重连或重放。

启动或进程结果失败后，预留项在原生进程范围清空后释放；有界完成缓存保留原始拒绝结果，供后续读取。辅助程序关闭也会等待已在进行的端点与目录清理。

终端启用 shell 活动观察时，根进程退出会保留 reservation 及其剩余工作。活动 RPC 继续访问 provider；明确终止时先等待进程范围完全停稳，再释放端点并记录完成结果。helper 连接卸载和租约到期仍保留原有的终止权限。

连接会禁用 helper 的 SIGUSR1 调试器激活：脚本调用使用 `--disable-sigusr1`，可执行文件调用通过 `NODE_OPTIONS` 提供该标志。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [SSH 子系统](../../../docs/subsystems/ssh.zh.md) — 执行坐标、传输语义及生命周期归属。
- [POSIX SSH 决策](../../../.agents/notes/implemented/architecture/2026-09-11-posix-ssh-runtime.zh.md) — 理由、替代方案及必要验证。

---

## 🚀 快速开始

在自定义 `dsh` 配置组合中，将本服务与 [`fs-ssh`](../fs-ssh/README.zh.md)、[`subprocess-ssh`](../subprocess-ssh/README.zh.md) 和 [`sandbox-ssh`](../sandbox-ssh/README.zh.md) 组合。主机运行 Harness、模型传输和 Session 存储；远端机器提供文件与进程。headless 配置组合支持这种安排。

### 部署前提

两端均需运行 Linux 或 macOS。本地 `ssh` 命令必须支持连接复用与 Unix 套接字转发，服务器也必须允许该转发。启动

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-ssh
