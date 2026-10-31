---
title: "@deepseek-ai/dsh-host-webserver"
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

浏览器经由 `dsh-host-webserver` 通过 HTTP 访问 web GUI：一个 `node:http` 服务器——当 `tls` 指定证书与私钥时改用 `node:https`——其他插件在其中注册具名路由、upgrade 路由、index 启动输入与一个回退 handler。它不了解任何 harness 概念，也不提供任何文件服务——`/api` 桥接、插件 bundle、HMR（热模块替换）事件流与 SPA dist 都属于注册它们的插件。路由匹配顺序固定不变：先在整张表中匹配精确 route，再匹配最长前缀，最后交给回退 handler。它只服务浏览器；Electron 通过 `file://` 加载 dist，并经 IPC 桥接承载 fetch。

---

## ⚡ 功能

### 限制

这些限制说明服务器在何处有意保持最小。它们是当前包约束，不是任务积压。

- **不管理证书生命周期**：`tls` 只提供激活时存在的 PEM 文件——载体从不申请、续期或监视它们，并采用 Node 默认的 TLS 策略。替换证书需要重新加载。
- **不提供服务器级认证或来源策略**：`dsh-client-connection` 等 route owner 会实施自己的请求策略。绑定非回环地址仍会向该网络公开未受保护的 route 与静态资源。
- **Socket 选项固定不变**：配置只选择绑定宿主与端口；在具体部署产生需求前，backlog 和其他 socket 设置仍保持内部实现。

---

## 📊 指标

无。该 HTTP 载体只桥接浏览器与 API handler，不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

本包是一个不带任何 harness 词汇的普通路由注册表：`WebServer` 继承 Cordis `Service`，持有三张路由表、回退 slot、原始 index 转换列表，以及 `webserver/index-inject` 事件，index 渲染器经其收集行。index 渲染每次响应组合两层：`renderIndex` 先把包含提示性 `script-preload` 行的全新注入表渲染进正文，再按注册顺序应用原始转换；`applyIndexTaps` 只运行转换。upgrade handler 拥有协议握手与连接内容；webserver 只交付原始 socket 与 request。`host`、`port` 与 `protocol` getter 暴露其他插件据以自适应的组合期事实（例如 directory-picker 选择器），而显式的 `tls: null` 会归一为未设置监听，使 `protocol` 只有一个来源。

### 匹配与生命周期

`match(pathname)` 先查精确表，再遍历前缀表取最长匹配，最后走回退。激活会注册一个拥有整段获取过程的 effect——TLS 读取、明文或安全服务器、以及绑定——因此落在初始化中途的资源释放会等待该监听并在其后关闭它，而不会留下无主的监听。资源释放会启动 `close()` 与 `closeAllConnections()`，销毁所有受跟踪的升级 socket 与所有原始 TLS 连接，并仅在服务器与这些 socket 均已关闭后返回。Node 的 `closeAllConnections()` 既不包含升级 socket，也不包含握手尚未完成的 TLS socket，因此服务显式跟踪二者。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `WebServer` 服务：路由表、回退席位、index 渲染、匹配、TLS 监听、生命周期 |
| [`src/injections.ts`](src/injections.ts) | 结构化 `IndexInjection` 行与 `renderIndexInjections` 行渲染 |
| [`tests/tls-fixture.ts`](tests/tls-fixture.ts) | 为 TLS 监听测试生成的 TLS 材料；其他测试套件可物化同一套材料 |

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

两条工作备注，均非权威结论：

- TLS 测试材料在测试时生成（`tests/tls-fixture.ts`），绝不入库：GitHub push protection 会拦截测试中的 PEM 私钥，况且该证书本就是一次性的。该助手每个进程签发一张自签名的 localhost 证书，覆盖 127.0.0.1、`::1` 与 `localhost`，并以仅属主可读的权限写入私钥。
- `selfsigned` 固定在 4.x：在 pnpm 下 5.x 会装入两份 `@peculiar/asn1-schema`，其 extension 构造器随后会让每次 `generate()` 抛错。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `WebServer` 服务：路由表、回退席位、index 渲染、匹配、TLS 监听、生命周期 |
| [`src/injections.ts`](src/injections.ts) | 结构化 `IndexInjection` 行与 `renderIndexInjections` 行渲染 |
| [`tests/tls-fixture.ts`](tests/tls-fixture.ts) | 为 TLS 监听测试生成的 TLS 材料；其他测试套件可物化同一套材料 |

---

## 🔗 资源

当服务器约定不够用时阅读以下内容：先看子系统参考，再看回退持有者，以及谁注册哪条路由背后的分层决策。

- [HTTP 服务器子系统](../../../docs/subsystems/web-server.zh.md)——路由、匹配顺序与服务器接受的配置。
- [SPA dist 服务器](../frontend-static/README.zh.md)——回退席位的随附持有者。
- [Web 配置树启动与传输分层](../../boot/app-boot/README.zh.md)——功能插件为何拥有每条路由。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-host-webserver)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-host-webserver'
  config:
    host: 127.0.0.1
    port: 3000
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `WebServer` 服务：路由表、回退席位、index 渲染、匹配、TLS 监听、生命周期 |
| [`src/injections.ts`](src/injections.ts) | 结构化 `IndexInjection` 行与 `renderIndexInjections` 行渲染 |
| [`tests/tls-fixture.ts`](tests/tls-fixture.ts) | 为 TLS 监听测试生成的 TLS 材料；其他测试套件可物化同一套材料 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-webserver
