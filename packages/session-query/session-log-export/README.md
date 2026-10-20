---
title: "@deepseek-ai/dsh-session-log-export"
tags: []
category: "session-query"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-session-log-export` 让 Web 界面可以下载会话的完整历史：Session Header 更多操作按钮下的 `下载 Session 日志` 菜单项与 `/export` 斜杠命令都会把会话树——会话本身、其子会话与附件——作为 ZIP 交给浏览器下载。本包拥有 Host 归档流、经过认证的 Fetch 路由以及浏览器控件和反馈。下载目标位置由浏览器选择。设置与用法在前，随后说明实现细节。

---

## ⚡ 功能

### 适用场景

为需要带可见下载弹窗的面向用户的会话导出的 Web 部署选择它。需要程序化或 Host 侧导出时避免使用：本包产生的是浏览器下载，而非 Host 路径写入。日志从持久化读句柄序列化而来，因此任何已挂载后端都受支持。

### 限制

这些限制说明本包何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是任务积压。

- **浏览器下载，而非 Host 路径写入**——目标位置由浏览器选择；不会返回 Host 路径或原生文件夹操作。
- **预检只报告流式传输前的失败**——浏览器接受 GET 后发生的子会话或附件读取失败由浏览器下载管理器报告，不通过弹窗报告。

---

## 📊 指标

### 用户 `/export` 控制

#### 模型看到什么

无。`/export` 留在用户命令平面，ZIP 下载不会进入模型历史。

#### Token 影响

为零。该命令不创建模型轮次。

#### KV Cache 影响

无。仅日志命令生命周期与浏览器下载不会改变派生请求前缀。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释本包如何接入导出控件，并指出实现它的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计拆分

本包分为两部分。Host 半包（[`src/index.ts`](src/index.ts)）注册 `/export` 命令，并向 Connection 贡献精确的 `GET`/`HEAD /api/session.export` Fetch 路由；[`src/archive.ts`](src/archive.ts) 构建有界 ZIP 流。浏览器半包（[`src/client/index.ts`](src/client/index.ts)）提供共享下载控制器和 UI，并观察 `command/executed`，因此只有提交命令的浏览器会启动下载。

Header 的更多操作入口使用公共紧凑 Button，点击区域为 28px 正方形，与右侧栏展开控件共用圆角和 hover 底色。

### 下载流程

两条入口都会先向文档相对的 `api/session.export?...` 发出 `HEAD` 预检请求，然后把 GET 路由交给浏览器下载管理器，JavaScript 不缓冲 ZIP。一个控制器按会话持有一项进行中的下载，把并发操作折叠进该任务，并在插件释放时取消预检。弹窗状态存放在按会话键控的快照存储中，因此按钮与命令按会话共享一个弹窗。

Host 路由是由该功能拥有的精确 Fetch 路由贡献。Connection 应用 Host/Origin 与浏览器会话检查并桥接流式 `Response`；本包拥有查询校验、活动会话 flush、基于句柄的日志读取与附件读取、ZIP 生成和 HTTP 状态语义。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放设计问题与尚未决定的探索方向。它明确不具权威性——已交付的行为、限制与既定理由以上文、包代码和相关页面为准。

#### 未来：浏览器之外的导出目标

下载刻意限定在浏览器范围；Host 路径或原生文件夹导出需要新的端点约定，并决定 ZIP 的落盘位置。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从 Web 控件逐步进入 Host 端点及相关的命令与会话接口。

- [dsh-client-connection](../../client/connection/README.zh.md)——Host 端点使用的认证 Fetch 路由载体。
- [命令子系统参考](../../../docs/subsystems/commands.zh.md)——`/export` 命令注册的用户命令注册表。
- [dsh-client-ui-commands](../../client/ui-commands/README.zh.md)——渲染并确认 `/export` 的浏览器命令界面。
- [会话查询包映射](../README.zh.md)——本包所属的检索包族。

---

## 🚀 快速开始

### 配置

```yaml
- id: session-log-download
  name: '@deepseek-ai/dsh-session-log-export'
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `compressionLevel` | `6` | 每个 ZIP 条目的 DEFLATE 级别，范围为 0 到 9。 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-log-export
