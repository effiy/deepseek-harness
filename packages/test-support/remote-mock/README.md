---
title: "@deepseek-ai/dsh-remote-mock"
tags: []
category: "test-support"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-remote-mock` 让测试通过 `mock.remote.<namespace>.<method>`，使用原生 Vitest mock 方法配置 Host 响应。同一组函数应答直接调用与真实 Connection 流量；可复用的表提供默认响应，显式声明的流支持测试驱动的推帧与取消。缺少响应时调用失败，`assertNoUnmatched()` 会在收尾时再次报告。本包无需业务 Host 即可在 Node 或浏览器页面中运行，不导入 DOM、React 或 Node 模块，只从 `devDependencies` 消费。

---

## ⚡ 功能

### 适用场景

当测试要启动与 `ctx.remote` 对话的真实客户端插件、并想按端点名脚本化 Host 侧时使用它：整体客户端测试把 `mock.rpc` 绑定到各自的 Connection 实例，单元测试也可以直接调用 `mock.remote`、`dispatch` 或 `open`。端点是 Gateway 的 wire 名（`session/page`、`settings/describe`）；`args` 是调用方的位置参数列表，末尾的 `AbortSignal` 已剥掉；值就是测试登记的东西，原样应答。唯一的声明是端点是一元（`unary`）还是流（`stream`）。

### 限制

- **仅进程内载体**——`rpc` 服务同一 realm 中的 Connection 实例；不提供给浏览器车道测试用的 HTTP 或 WebSocket 载体。
- **值按引用传递**——应答与下行项都未经序列化就到达客户端，真实线路会拒绝的非 JSON 下行值在这里原样通过；只有句柄的 `send()` 施加真实的上行校验。
- **不校验值**——一元应答必须是调用方读取的结果（`{ ok, value }` 或 `{ ok: false, error }`）；mock 原样传递它，不检查这些字段。
- **不做 payload 匹配**——规则只按端点匹配；在 handler 内按业务参数判别。
- **原生流覆盖自行管理 iterable**——覆盖返回自有 iterable 时，不参与脚本流日志、`requests`、`opened`、`drained` 以及 `push` / `end` / `fail`；调用方也负责取消。原生调用断言仍然有效。需要这些控制能力的场景应使用已登记的流脚本。

---

## 📊 指标

无；本包是浏览器侧测试基础设施，无一物到达模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

### 设计

`dispatch` 与 `open` 接收端点与位置参数；`rpc` 通过 Connection 的已解码载体接口暴露同一个核心。每个 mock 独立持有原生函数及排队覆盖；共享表提供默认响应，不复制 handler 或应答对象。每条脚本流拥有自己的队列、唯一挂起读取和日志条目；`end`、`fail`、消费方取消三者中最先发生者定局。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 公开面转出 |
| [`src/remote-mock.ts`](src/remote-mock.ts) | `RemoteMock`：默认响应、原生 mock、Connection 分发、受控流与缺失响应检查；`ok` |
| [`src/remote-proxy.ts`](src/remote-proxy.ts) | 命名空间／方法查找与生成映射的 mock 类型 |
| [`src/streams.ts`](src/streams.ts) | `frames` / `openStream` 脚本、`streamHandle` / `streamMethod` 假实现标注，以及 `MockStream`（句柄 + `AsyncIterable`） |
| [`src/log.ts`](src/log.ts) | 带共享 `seq` 计数器的日志 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 公开面转出 |
| [`src/remote-mock.ts`](src/remote-mock.ts) | `RemoteMock`：默认响应、原生 mock、Connection 分发、受控流与缺失响应检查；`ok` |
| [`src/remote-proxy.ts`](src/remote-proxy.ts) | 命名空间／方法查找与生成映射的 mock 类型 |
| [`src/streams.ts`](src/streams.ts) | `frames` / `openStream` 脚本、`streamHandle` / `streamMethod` 假实现标注，以及 `MockStream`（句柄 + `AsyncIterable`） |
| [`src/log.ts`](src/log.ts) | 带共享 `seq` 计数器的日志 |

---

## 🔗 资源

「待补充」

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-remote-mock
