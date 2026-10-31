---
title: "@deepseek-ai/dsh-tool-call-timeout-policy"
tags: []
category: "guard"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用本包可为工具调用执行其配置的协作式时间上限，并在取消完成后向模型返回清晰的超时错误。按时完成的调用保持不变。忽略或缓慢处理取消的工具仍可能让调用方继续等待，因为本包无法硬性停止下游工作。每个工具分别提供自己的限时；本包无需配置，并随 `dsh` 基础组合包默认启用。

---

## ⚡ 功能

### 适用场景

当模型会调用耗时很长的工具、这些工具会遵守 `exec.signal`，且你希望在取消完成后得到可预期的超时答复时，选择它。当工具必须在到达限时后被硬性停止时——插件只能请求工具停止，因此忽略取消的工具会继续运行并让调用方继续等待——以及当你希望为所有工具设置一个统一默认限时时（因为每个工具的限时来自该工具自身的配置），避免使用它。

### 限制

这些限制说明策略何时不合适。它们是当前包约束，不是任务积压。

- **协作式，绝不是硬终止**——截止时间只通过 `exec.signal` 通知；忽略该信号的工具不会在超时时停止，包装层仍停留在 `await next()` 内，模型要等下游完成后才可能收到超时结果。
- **没有统一预算**——只有声明 `timeoutMs` 并将其放在 `ToolDefinition` 上的工具才会获得截止时间；未声明工具（随附的 `bash`、`read`、`write`、`edit` 有意不声明）没有注册表级默认值。

---

## 📊 指标

### 条件工具结果

#### 模型看到什么

此插件不添加提示词或 schema。如果已声明的截止时间先到且下游取消完成，它会用 `Error: tool call timed out after <ms>ms` 与结构化 `TOOL_TIMEOUT` 错误替换提供方结果；否则原结果保持不变。永不完成的下游调用无法产生超时结果。

#### Token 影响

未超时的调用不会增加 token。超时会添加一条会被保留的简短错误结果，并可防止体积更大、较晚返回的提供方结果进入上下文。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释插件如何在每次分发周围设置截止时间并将其映射为 `TOOL_TIMEOUT` 结果，并指出实现它的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

包装层建立在四项承诺之上：

- **强制执行归属，而非库。** `dsh-timeout` 负责时序与分类（`deadline`、`timeoutOf`）；本插件负责 `tools/execute` 上的单次调用接线；各能力负责终止。该拆分记录在[超时截止时间库 Agent Note](../../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.zh.md) 中。
- **工具声明自己的预算。** `timeoutMs` 位于工具的 `ToolDefinition` 上，从注册表读取（`ctx.tools.get(exec.name, exec.agent)?.timeoutMs`），因此不可能拼错工具名，未声明工具原样委派。
- **作用域分类。** `TOOL_TIMEOUT` 同时用作内部 `deadline` 分类码与结构化错误 `code`；把 `timeoutOf` 限定到它，可避免嵌套的外层截止时间（先触发的另一包装层计时器）被误读为本插件的超时——它读作普通的上游取消。
- **先交换信号，再恢复。** Cordis `next()` 忽略传入参数，因此包装层原地修改共享 `exec`：分发时把派生的截止时间信号换到 `exec` 上，并在 `finally` 中恢复调用方信号，使 `tools/post-execute` 监听器永远看不到本插件可能已中止的信号。

### 截止时间如何设置与映射

一个 `tools/execute` 监听器从注册表读取已分发工具声明的限时（`ctx.tools.get(exec.name, exec.agent)?.timeoutMs`）；没有限时的工具原样委派。对有限时的工具，`deadline(exec.signal, timeoutMs, TOOL_TIMEOUT)` 构建融合信号，包装层在分发时把它换到 `exec` 上并在 `finally` 中恢复，使 `tools/post-execute` 监听器永远看不到派生信号。当包装层自己的计时器触发时——`timeoutOf(d.signal, 'TOOL_TIMEOUT')` 以代码限定作用域，因此嵌套的外层截止时间读作普通的上游取消——已被分发规范化为错误结果的分发结果会被替换为结构化结果：`isError: true`、内容 `Error: tool call timed out after <ms>ms`、错误信息 `{ name: 'ToolTimeoutError', code: 'TOOL_TIMEOUT' }`。

### 与其他包装层组合

多个 `tools/execute` 监听器按 Cordis 注册顺序组合，注册顺序决定语义：超时注册在外层时覆盖整个重试操作，注册在内层时覆盖每次尝试。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`TOOL_TIMEOUT`、`name`／`inject`／`apply`、`tools/execute` 包装层 |

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放问题与尚未决定的探索方向。它明确不具权威性——已交付的行为、限制与既定理由以上文、包代码和相关 Agent Note 为准。

`src/index.ts` 中的 FIXME 要求确定 `@deepseek-ai/dsh-timeout-guard` 改名；[改名台账](../../../.agents/notes/archived/architecture/2026-08-11-repository-naming-contract-and-rename-ledger.md) 已把 `@deepseek-ai/dsh-tool-call-timeout-policy` 记录为既定名称，因此该 FIXME 已陈旧，待代码清理。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`TOOL_TIMEOUT`、`name`／`inject`／`apply`、`tools/execute` 包装层 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从工具调用流水线逐步进入超时库拆分、被执行的限时与 guard 组映射。

- [工具子系统参考](../../../docs/subsystems/tools.zh.md)——本包装层挂钩的 `tools/execute` waterfall（瀑布式事件）与决策形态。
- [超时截止时间库 Agent Note](../../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.zh.md)——时序／终止拆分以及截止时间为何只通知。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-tool-web)——策略所执行的 `dsh-tool-web` 的 `fetchTimeoutMs`／`searchTimeoutMs` 预算。
- [guard 组映射](../README.zh.md)——同组的 guard 包与循环卫生家族。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-tool-call-timeout-policy'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`TOOL_TIMEOUT`、`name`／`inject`／`apply`、`tools/execute` 包装层 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-timeout-policy
