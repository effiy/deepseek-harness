---
title: "@deepseek-ai/dsh-typert-protocol"
tags: []
category: "typert"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

借助 `dsh-typert-protocol`，业务包可以向 Remote 客户端暴露 Host 方法：用 `@Remote`（作用域接收者用 `@RemoteScope`）标记方法，把服务绑定到 wire 命名空间，并通过可合并扩展的协议映射把 Host 对象与作用域 Context 关联到 wire identity。生成产物、Host Gateway 与 Client API 消费同一套调用描述符、编解码器与提供方约定。调用持有的值把清理责任交给 Gateway，不另增引用计数。本包不注册任何 Cordis 服务，也不运行 TypeScript 分析。

---

## ⚡ 功能

### 限制

这些限制说明声明能表示什么；它们是当前包约束，不是任务积压。

- **装饰器标记是最小化的**——标记只包含方法名与直接调用或 Context 调用模式；参数、结果、查找与 schema 反射需要 Typert 构建流水线。
- **Remote 签名受限**——装饰器只接受具有字符串名称的公开、非静态实例方法，源码模式执行无法表示重载、解构、默认参数或剩余参数签名。

---

## 📊 指标

无，因为与编译器无关的 Remote 协议声明不注册任何面向模型的内容。

#### KV Cache 影响

无直接影响；声明的约定只有在装配将其放入请求时才会触及请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释声明如何保持与编译器无关，以及每个约定在哪里执行；编程模型已在[使用本包](#use-this-package)中说明。

### 设计理念

本包把严格反射留在编译器中：装饰器初始化器把最小标记保存在 Service 原型上的带版本描述符中。描述符使用稳定的字符串属性名，因此协议包的另一个已安装副本也能读取同一组标记。完整的参数、结果、查找与 schema 反射是 Typert 构建流水线的职责，通过 `InvocationDescriptor` 交付。

### Remote 标记

`@Remote` 与 `@RemoteScope` 调度一个初始化器，把方法名、可选导出名与调用模式追加到原型描述符；`remoteMethods(service)` 校验其版本，并返回与已存描述符分离、按声明顺序排列的快照，供 Gateway 的源码模式回退读取。标记要求名称为字符串的公开、非静态实例方法，同一方法上的冲突标记会被拒绝。

### 协议映射与描述符

可合并扩展的协议映射在类型系统中保留静态关联，运行时提供方则向 `ctx.typert` 注册解析；映射的名称与形状见 [`src/types.ts`](src/types.ts)。`InvocationDescriptor` 是注册表、Gateway 与 Client Remote 共同消费的共享运行时形式，涵盖直接与 Context 接收者、JSON 与查找参数、作用域投影、上行编解码器、取消与结果编解码器。

### Wire 标识文法

每个命名空间、方法、查找与 Context 段都必须满足 `isTypertRemoteSegment()`，生成的名字才能原样跨共享 RPC 载体传输。严格编解码器携带生成的 schema factory；`src-json` 编解码器标识约束更弱的源码启动路径。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 装饰器、Gateway 绑定、`remoteMethods`、段校验 |
| [`src/json-value.ts`](src/json-value.ts) | 各载体共享的无损 JSON 校验 `isRemoteJsonValue` 与 `isRemoteUplinkItem` |
| [`src/remote-error.ts`](src/remote-error.ts) | `RemoteError` 与结构式识别函数 `remoteErrorOf` |
| [`src/types.ts`](src/types.ts) | 协议映射、`RemoteErrorDetailsMap`、`RemoteResult`、`RemoteStream`、`RemoteStreamHandle`、`PeerScope`、`RemoteInvocation`、`InvocationDescriptor`、编解码器、提供方约定、注册表接口、`TypertClientRemote` |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 装饰器、Gateway 绑定、`remoteMethods`、段校验 |
| [`src/json-value.ts`](src/json-value.ts) | 各载体共享的无损 JSON 校验 `isRemoteJsonValue` 与 `isRemoteUplinkItem` |
| [`src/remote-error.ts`](src/remote-error.ts) | `RemoteError` 与结构式识别函数 `remoteErrorOf` |
| [`src/types.ts`](src/types.ts) | 协议映射、`RemoteErrorDetailsMap`、`RemoteResult`、`RemoteStream`、`RemoteStreamHandle`、`PeerScope`、`RemoteInvocation`、`InvocationDescriptor`、编解码器、提供方约定、注册表接口、`TypertClientRemote` |

---

## 🔗 资源

当包级约定不够用时阅读以下页面；它们从声明逐步进入运行时与调用路径。

- [API Gateway 参考](../../../docs/api-gateway.zh.md)——声明如何成为实际的 Host 到 Client 调用。
- [Typert 子系统参考](../../../docs/subsystems/typert.zh.md)——从协议与 Gateway 类型记录的字面公共约定。
- [Typert 注册表](../registry/README.zh.md)——描述符与提供方在运行时存放的位置。
- [Typert 生成器](../generator/README.zh.md)——生成消费方声明与描述符的包。
- [Remote 调用 Agent Note](../../../.agents/notes/implemented/architecture/2026-08-02-typert-remote-method-calls.zh.md)——Remote 调用背后的架构与传输决策。

---

## 🚀 快速开始

```ts
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export class GoalService extends TypertRemoteService {
  @Remote
  async create(agentId: string, objective: string): Promise<GoalResult> {
    ...
  }
}
```

```ts
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'goal/not-found': { readonly goalId: string }
  }
}
throw new RemoteError('goal/not-found', `goal "${id}" does not exist`, { goalId: id })
```

在 Client 侧接收转发的 Host 事件

Host 装配以转发给消费方的 Cordis 事件扩展 `TypertRemoteEventSelection`，从而收窄 `ctx.remote.$on` 的键集。`TypertForwardableEvent` 接受无作用域且返回 `void` 的通知，以及最后一个 `next()` 回调返回事件结果类型的异步作用域 waterfall（瀑布式事件）。`TypertClientEventListener` 从同一条 `Events` 成员派生 Client listener，并保留 signal、可选和只读字段、数组、回调与结果类型。`TypertClientRemote` 只公开 `$mount()` 与 `$on()`；事件传输仍由 Gateway 私有持有。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-protocol
