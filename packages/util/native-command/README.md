---
title: "@deepseek-ai/dsh-native-command"
tags: []
category: "util"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-native-command` 无需 shell 即可运行 Host 可执行文件，并通过桌面打开 Host 文件系统路径。命令运行器捕获 utf8 输出、传播取消，并要求显式指定 Windows 启动时的窗口可见性。路径打开器支持默认应用与文本编辑器意图、浏览器可渲染文档、WSL 转换与桌面可用性检查。它是库而非插件：没有 `ctx`、无状态、不发事件。

---

## ⚡ 功能

### 限制

Linux 的关联查询和指定应用启动需要 GIO。缺少原生命令时查询失败，缺失的图标返回 null；调用方可以保留文件定位作为备用动作。


这些限制说明本运行器何时不是合适的工具。它们是当前包约束，不是任务积压。

- 命令输出受 Node 的 `execFile` 缓冲上限约束，超过上限时拒绝结果。流式输出由 subprocess 能力处理。
- Windows 关联处理器的图标只在 Shell 能解析其间接引用时显示；解析失败时回退到处理器的可执行文件，处理器没有给出可执行文件（打包处理器可能只报 AUMID 或家族名）时则没有图标。
- Windows 主机需要交互桌面会话。在非交互会话（服务，或没有交互登录的计划任务）中，`explorer.exe` 不调用任何文件关联，且仍在约 1 秒后以退出码 1 返回（Windows 11 ARM64 build 26200 的 SSH session 0 实测），于是「打开」会报告成功却什么都没打开；调用方的 abort 信号把这段等待变成超时而不是挂死。同一目标改用 `Invoke-Item` 命令时可在该会话内解析关联，目录失败也会以非零退出码报出。该会话下的兜底尚未实现。

---

## 📊 指标

无：宿主侧工具不注册任何面向模型的内容。

#### KV Cache 影响

此处没有任何内容进入请求前缀；本包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

命令运行器是 Node `execFile` 的薄包装。路径打开器根据平台与环境事实选择一条无 shell 命令，而调用方继续负责决定允许打开哪个路径。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 命令运行器与路径打开器的公共导出 |
| [`src/runner.ts`](src/runner.ts) | 无 shell 的 `execFile` 适配器 |
| [`src/path-opener.ts`](src/path-opener.ts) | 桌面探测、打开意图、浏览器偏好与 WSL 转换 |

### execFile 给了运行器什么

`execFile` 以 argv 数组直接 spawn 可执行文件——没有 shell 字符串，参数不经 shell 解释。`signal` 选项在调用方中止触发时终止子进程；`window` 由运行器映射为 Node 的 `windowsHide` 选项。遇到非零退出或 spawn 错误时，回调把 `code`、`stdout`、`stderr` 挂到被拒绝的错误上，并保留原始错误作为 `cause`。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 命令运行器与路径打开器的公共导出 |
| [`src/runner.ts`](src/runner.ts) | 无 shell 的 `execFile` 适配器 |
| [`src/path-opener.ts`](src/path-opener.ts) | 桌面探测、打开意图、浏览器偏好与 WSL 转换 |

---

## 🔗 资源

当你需要消费方或本工具刻意不属于的通用子进程能力时，阅读以下页面。

- [原生目录选择器](../../host/directory-picker-native/README.zh.md)——本运行器执行的 OS 选择器命令。
- [Session Controller](../../api/session-controller/README.zh.md)——打开前解析 Session 相对 workspace 路径。
- [Settings Controller](../../api/settings-controller/README.zh.md)——选择 settings 文档。
- [子进程能力](../../subprocess/subprocess/README.zh.md)——通用子进程 seam，本包并非其组成部分。

---

## 🚀 快速开始

```ts
import { runNativeCommand } from '@deepseek-ai/dsh-native-command'

declare const script: string
declare const signal: AbortSignal
const { stdout, stderr } = await runNativeCommand('osascript', ['-e', script], signal, 'hidden')
```

运行一条命令



退出码为 0 时，调用解析为捕获到的 stdout 与 stderr。任何失败都会以错误拒绝，错误附带退出 `code` 与两路已捕获输出，因此调用方无需重跑命令即可区分工具缺失（`ENOENT`）、取消（`ABORT_ERR`）与真实的命令失败。必填的第四个参数 `window: 'hidden' | 'visible'` 控制 Windows 启动时的窗口可见性，在其他平台不生效。后台命令传入 `'hidden'`，GUI 启动程序传入 `'visible'`。路径打开器为 Explorer 选择 `'visible'`，包括 WSL 转交和文件选中操作，因为隐藏 Explorer 也会隐藏它的文件夹窗口。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-native-command
