---
title: "@deepseek-ai/dsh-host-frontend-static"
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

从配置的发布目录向浏览器提供已构建的 Web 壳。根路径与配置的 index 路径渲染包含启动信息的 index；已有资产直接提供，而缺失或非文件路径返回 404、路径遍历返回 403、不支持的方法返回 405。访问 index 需要有效的进程 token 或浏览器 cookie，但静态资产仍可公开访问。同一时间只能有一个实例处理未匹配的路由；第二个实例启动失败，卸载活动实例后，未匹配的请求返回 404。

---

## ⚡ 功能

### 限制

这些限制说明某个资产类别何时尚未被覆盖。它们是当前包约束，不是任务积压。

- **初始 MIME 表很精简**：它覆盖 Vite 输出的资产集合及实际交付的 PWA manifest；其他扩展名在相应资产类别发布前都会回退到 `application/octet-stream`。
- **Pathname 路由是显式声明**——当前客户端从根目录或配置的 index 路径进入，没有 History API pathname 路由。新增一条需要显式服务器规则与真实组合覆盖，而不是对每次未命中做宽泛回退。

---

## 📊 指标

无。该 SPA dist 服务器只应答浏览器资产请求，不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

本包是围绕 `serveStatic` 的一个函数插件：`apply` 从 `distIndex` 解析出 dist 根目录，构建一个对原始 `index.html` 运行 `ctx.webServer.renderIndex` 并把文档 base 拼接在起始 head 标签之后的 `renderIndex` 闭包（在原始转换之后执行，因此也先于其标记），并在 effect 作用域下注册回退 handler。按 webserver 的约定，席位只有单一所有者——第二次注册会抛错——且受 effect 作用域约束，因此 dispose fiber 即释放席位。

### 遍历栅栏

`serveStatic` 规范化请求的 pathname 并拼接到 dist 根目录，然后要求目标就是根目录本身或保持在它之下。检查使用 `sep` 而非 `/`，因为 `resolve()` 在 Windows 上输出反斜杠路径，此时 `/` 后缀会把每个合法子路径都当作遍历拒绝。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `serveStatic` 与 `apply`：回退占据、遍历拒绝、index 渲染、MIME 表 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `serveStatic` 与 `apply`：回退占据、遍历拒绝、index 渲染、MIME 表 |

---

## 🔗 资源

当服务约定不够用时阅读以下内容：先看席位所有者的约定，再看解析 dist 的组合与子系统参考。

- [Webserver](../webserver/README.zh.md)——本插件占据的回退席位与它运行的 index 转换器。
- [dsh-web-app 组合包](../../bundle/web-app/README.zh.md)——解析 `distIndex` 并挂载本插件的应用。
- [HTTP 服务器子系统](../../../docs/subsystems/web-server.zh.md)——回退席位如何融入路由表。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-host-frontend-static)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-host-frontend-static'
  config:
    distIndex: /absolute/path/to/dist/index.html
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `serveStatic` 与 `apply`：回退占据、遍历拒绝、index 渲染、MIME 表 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-frontend-static
