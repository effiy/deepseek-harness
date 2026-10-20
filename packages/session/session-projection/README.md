---
title: "@deepseek-ai/dsh-session-projection"
tags: []
category: "session"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

当客户端需要当前的逐会话状态（例如待办事项、目标或对话统计）而不应自行重放原始事件日志时，使用 `dsh-session-projection`。领域根据已提交的会话事件定义同步投影，客户端则通过快照与变更通知接收经过 schema 校验的完整 JSON 值。快照标明所有返回值共同反映到的最后一个事件，因此载体可以把状态与对应的历史切面配对。投影状态可以通过检查点加快冷读，而仅供 host 使用的投影不会暴露给客户端。

---

## ⚡ 功能

### 适用场景

当领域保存客户端应看到、但不应自行重新派生的状态——todo 清单、goal 快照、对话统计——时选择本包。注册表在已提交事件上主动驱动单元，因此任何已注册单元的值按构造即为当前值。当维护的是无客户端读取的 host-only 记账时跳过：不带 `wire` 块的单元保持 host-only。host 读取方要么在插件 `inject` 中声明 `sessionProjections`，要么在注册表或必需 key 缺席时明确失败。贡献方可以继续通过 `ctx.inject(['sessionProjections'], ...)` 保持可选注册。

### 限制

这些限制说明投影注册表在大规模下何时需要特别处理。它们是当前包约束，不是任务积压。

- **每个尾页携带每个 client-visible key**——尚无逐 key 的 opt-out 或惰性 key 请求形状；在值都是 UI 量级的全量状态时可以接受，若某领域的值变大再重议。
- **单元表是进程级的，因此 key 是否存在不能当作逐会话的能力信号**——任何 agent preset 注册的 key 都会出现在每个会话的快照里；客户端必须读值，不能把 key 缺席当作功能缺席。
- **主动驱动逐事件触达每个单元**——按构造开销很低（全量值规则与 state/view 引用闸门），但若出现热点路径，可加按单元的事件类型预过滤。
- **注册表 cell 只活在内存里**——重启后首次触达时靠折叠日志重建；挂载了 `dsh-session-projection-cache` 的组合改由持久行播种该折叠。
- **单元同步纪律只有部分可机械把关**——`wire.viewSchema.parse` 能拒绝返回 Promise 的 view，但阻塞的 `apply`、或读取撕裂的非会话状态的 `apply`，只能靠评审把关。

---

## 📊 指标

无——注册表只为已入日志的会话状态提供面向客户端的读模型，不注册任何模型可见内容。

#### KV Cache 影响

无；投影从不组装或发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节说明驱动机制与单元约定；可观察约定已在[使用本包](#use-this-package)中说明。

### 设计理念

本包是能力 seam 的 Service Definition 与驱动角色：框架负责驱动，领域负责计算。注册表只订阅一次 `session/event`；每个已提交事件都会主动经过每个已注册单元的 `apply`（cell 在首次触达时惰性构建）。第一层 `Object.is` 闸门在 state 引用不变时跳过 view 工作；live drive 的双槽缓存复用前一个原始 view，第二层 `Object.is` 闸门在原始 view 引用不变时抑制发布。载体在切出页面切片的同一 tick 内读取 `snapshot()`，`asOfSeq` 之所以是一个一致切面正系于此；误写成异步的 view 会返回 Promise，并被 `wire.viewSchema.parse` 拒绝。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SessionProjectionRegistry` 服务、`ProjectionDefinition`、快照与检查点机制 |
| [`src/types.ts`](src/types.ts) | 可合并扩展的 `SessionProjectionMap` 与 `SessionProjectionStateMap` 类型表 |

### 驱动与检查点流程

一个已提交事件按注册顺序驱动每个已注册单元；原始 view 通过 `Object.is` 判定为变化的客户端可见单元会以经 schema 校验的视图与致因 seq 通知变更流。live drive 保留前后两个原始 view；snapshot 与冷读仍是彼此独立的完整读取。`checkpoint(session)` 为持久缓存返回每个单元一份独立的 `(key → {ver, seq, val})` 行；`restoreFloor` 把尾部读取锚定在最低可用水位之前一个事件处，使缩短的日志可被检出；`restore` 把持久行在存储后缀上重新折叠，丢弃任何 `ver` 不匹配或声称越过存储末尾的行。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SessionProjectionRegistry` 服务、`ProjectionDefinition`、快照与检查点机制 |
| [`src/types.ts`](src/types.ts) | 可合并扩展的 `SessionProjectionMap` 与 `SessionProjectionStateMap` 类型表 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从单元约定逐步进入读模型子系统与持久缓存。

- [会话投影子系统](../../../docs/subsystems/session-projection.zh.md)——投影单元约定、驱动语义与生成的服务 API。
- [会话持久化子系统](../../../docs/subsystems/persistence.zh.md)——投影折叠其上的事件日志。
- [会话投影缓存](../session-projection-cache/README.zh.md)——让冷读跳过全量日志加载的持久检查点。
- [会话包映射](../README.zh.md)——相邻的持久化、标题与遥测包。
- [会话投影 RFC](../../../.agents/notes/proposed/architecture/2026-07-27-session-projection-and-command-log.zh.md)——投影与命令日志的设计理由。

---

## 🚀 快速开始

在客户端载体需要日志派生会话状态的当前值处挂载 `dsh-session-projection`。领域插件注册单元；载体读取快照并订阅变更流；两侧互不相识。

### 何时选择

当领域保存客户端应看到、但不应自行重新派生的状态——todo 清单、goal 快照、对话统计——时选择本包。注册表在已提交事件上主动驱动单元，因此任何已注册单元的值按构造即为当前值。当维护的是无客户端读取的 host-only 记账时跳过：不带 `wire` 块的单元保持 host-only。host 读取方要么在插件 `inject` 中声明 `sessionProjections`，要么在注册表或必需 key 缺

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-projection
