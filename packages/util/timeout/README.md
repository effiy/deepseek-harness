---
title: "@deepseek-ai/dsh-timeout"
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

`dsh-timeout` 让调用方为工作设置有上限的截止时间、区分本地超时与上游取消，并监测流式读取是否空闲。`clampTimeout` 在提示缺失时填入后端默认值，把结果限制在允许的最大值以内，并在工作开始前拒绝无效值。`deadline` 将选定的超时与上游取消合并到一个信号中，而调用方仍负责真正停止自己的进程、套接字或任务。`idleWatchdog` 只计算等待提供方读取所花的时间；零仍保留给后端自有的不计时工作，而不是公开配置。

---

## ⚡ 功能

### 限制

这些限制说明本库刻意不做什么。它们是当前包约束，不是任务积压。

- **只发出通知**——deadline 无法停止忽略其信号的工作；每项能力仍需要自己的 socket、进程或任务终止路径。
- **`timeoutMs <= 0` 是内部词汇**——只有在所属后端已解析策略后，它才会禁用本地 timer；绝不会作为面向模型或插件的公开开关。
- **第一个中止原因决定分类**——当上游取消早于本地 timer 发生时，即使自己的超时之后也会到期，该层也无法再报告。
- **空闲 watchdog 不是总 deadline**——它针对每个尚未完成的迭代器需求重新启动，并刻意排除消费方的处理时间。

---

## 📊 指标

通过渲染超时结果的超时消费方间接影响模型。

#### KV Cache 影响

不会直接导致失效；请求前缀的任何变更由超时消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本库建立在一个边界之上：共享时序与分类，把强制终止保留在本地。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `clampTimeout`、`deadline`、`idleWatchdog`、`timeoutOf`、`TimeoutReason`、`MAX_TIMER_DELAY_MS` |

### deadline 如何融合来源

`deadline` 启动一个 timer，并通过 `AbortSignal.any` 把它与上游信号融合；`AbortSignal.any` 采纳最先中止的来源的原因，因此竞争会归结为单一原因。`TimeoutReason` 携带能力自有的 `code` 与已流逝的 `timeoutMs`；只有当超时胜出时 `timeoutOf` 才读取它，上游胜出则保留普通的中止原因。`[Symbol.dispose]` 清除 timer。

### 无超时哨兵值

`timeoutMs <= 0` 不启动 timer，只转发上游信号——没有上游时返回永不中止的信号——因此每个调用方都保持同一种调用形态。该哨兵值服务于后端自有后台工作；外部请求提示在到达 `deadline` 之前先被验证为正有限值。

### 空闲 watchdog 为何重新启动

`idleWatchdog` 保持一个稳定的融合信号，只在 `next()` 尚未完成时启动 timer；完成后停止，后续需求或 `pulse()` 重新启动，dispose（资源释放）时清除，并发需求被拒绝。与 `deadline()` 不同，空闲 watchdog 会按自己的截止时间结算尚未完成的 demand：传输层在 abort 之后仍挂起的读取会让 `next()` 以该 watchdog 的 `TimeoutReason` reject，因此完全不观察信号的传输层也无法把等待拖过空闲间隔。信号仍用于让传输层释放自身资源——DeepSeek 与 pi-ai 适配器会在中止时关闭响应正文或 SDK 请求。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `clampTimeout`、`deadline`、`idleWatchdog`、`timeoutOf`、`TimeoutReason`、`MAX_TIMER_DELAY_MS` |

---

## 🔗 资源

当你需要消费方或库背后的边界决策时，阅读以下页面。

- [超时 deadline 库 Agent Note](../../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.zh.md)——共享时序、本地强制终止的边界。
- [工具调用超时策略](../../guard/timeout-policy/README.zh.md)——强制执行已声明工具超时的消费方。
- [bash 提供方](../../shell/bash-local/README.zh.md)——杀死进程组的前台 deadline 消费方。
- [文件系统子系统](../../../docs/subsystems/filesystem.zh.md)——本地文件 IO 为何不设时限。

---

## 🚀 快速开始

```ts
import { clampTimeout } from '@deepseek-ai/dsh-timeout'

declare const requested: number | undefined
declare const DEFAULT_TIMEOUT_MS: number
declare const MAX_TIMEOUT_MS: number

const timeoutMs = clampTimeout(requested, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, 'bash-local: request.timeoutMs')
```

```ts
import { deadline, timeoutOf } from '@deepseek-ai/dsh-timeout'

using d = deadline(upstream, timeoutMs, 'BASH_TIMEOUT')
const outcome = await runWork({ signal: d.signal })   // work listens on d.signal and terminates itself
const timedOut = timeoutOf(d.signal, 'BASH_TIMEOUT') !== undefined
const aborted = d.signal.aborted && !timedOut
```

限制超时提示



提示缺失时 `clampTimeout` 填入后端默认值，把结果限制在后端最大值以内，并以调用方提供的名字拒绝非正数或非有限值的提示。此处绝不接受 0：它不是公开的禁用超时值。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-timeout
