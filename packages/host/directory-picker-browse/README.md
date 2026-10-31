---
title: "@deepseek-ai/dsh-host-directory-picker-browse"
tags: []
category: "host"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

无法触达 OS 选择器的用户仍能通过 `dsh-host-directory-picker-browse` 选择工作区目录：它基于 Node 标准库提供单层目录列举与子目录创建，宿主屏幕上不渲染任何东西——因此它能服务原生后端无法触及的远程客户端。列举只返回目录、按名称排序，跟随指向目录的符号链接，并携带宿主判定的 `hidden` 标志；创建不递归，且把名称校验为单个路径段。一行组合配置还会用应用内**选择工作区目录**对话框填满工作区流程的目录扩展位。

---

## ⚡ 功能

### 限制

这些限制说明浏览交互在何处不完整或有意不限定范围。它们是当前包约束，不是任务积压。

- **不读取 Windows 隐藏属性**——Node 的 dirent 不暴露 `FILE_ATTRIBUTE_HIDDEN`，因此在所有平台上 `hidden` 都意味着点前缀，直到原生探测值得付出相应成本为止。
- **不枚举盘符根**——Windows 上祖先链止于盘符根；跨盘依赖浏览器 UI 的路径输入入口，而不是这里的枚举原语。
- **全盘可浏览**——没有按部署限定的浏览根；`workspace.create` 接受任意路径，因此这里的根会限定 UX 范围，而不是安全边界。

---

## 📊 指标

无。GUI 宿主的目录选择后端不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

后端把单个目录层级流式送入一个有界、按名排序的窗口，因此无论目录有多少子项，内存都保持 O(maxEntries)：被截断的层级保留按名排序的头部、隐藏行计入上限、只探测窗口内候选，并报告 `truncated: true`。窗口插入为二分查找、满窗尾部单次比较即拒绝，因此超大型层级在头部之后的每个候选都只需 O(1)，而不是窗口扫描。

### 完全限定栅栏

`fullyQualified` 拒绝任何不指向一个与进程状态无关的固定文件系统位置的路径：POSIX 上要求 POSIX 绝对路径；Windows 上只接受盘符限定（`C:\…`）或完整 UNC（`\\server\share…`）形态。无盘符有根形态与不完整 UNC 前缀能通过 `isAbsolute`，却仍会解析到进程的当前盘符，因此后端会拒绝它们，而不是重新定位协议传入的值。

### 中止与探测

每次等待文件系统操作时，都会通过 `raceAbort` 与调用方的信号竞争，因此停滞的网络文件系统无法让已离开的调用方请求继续存活；已放弃的读取操作即使稍后结束，其结果也会被忽略。符号链接的可进入性由 `stat` 探测决定——失败即不可进入——窗口内的断链符号链接不会从窗口外回填，因为发生过驱逐本身已把层级标记为截断。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `BrowseDirectoryPicker` 服务：列举、创建、有界窗口、错误映射 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `BrowseDirectoryPicker` 服务：列举、创建、有界窗口、错误映射 |

---

## 🔗 资源

当后端约定不够用时阅读以下内容：先看 seam 定义，再看决策记录与原生替代方案。

- [目录选择 seam](../directory-picker/README.zh.md)——`browse` 能力约定与类型化错误词汇。
- [目录选择能力 seam 决策](../../../.agents/notes/archived/architecture/2026-07-28-directory-picker-capability-seam.md)——列举与创建背后的策略裁决。
- [原生后端](../directory-picker-native/README.zh.md)——面向本地操作者的 OS 选择器替代方案。
- [自适应选择器](../directory-picker-auto/README.zh.md)——两个后端之间的启动时判定。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-host-directory-picker-browse)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

在远程浏览器、SSH 转发会话或无人值守宿主等无法使用 OS 选择器的场景中，如果必须选择工作区目录，请组合此后端。工作区流程驱动 `directoryPicker/list` 与 `directoryPicker/createDirectory`；两个原语都基于宿主文件系统返回结果。

### 列举目录

`list(path?)` 返回一个目录层级：按名称排序的子目录及其绝对路径、`hidden` 标志（POSIX 上为点前缀）、`home` 锚点，以及 `crumbs`——从根到目标的祖先链，其中每个 crumb 都是跳转目标，根以完整路径标注。不带路径时列举宿主账户的家目录。单次调用至

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-directory-picker-browse
