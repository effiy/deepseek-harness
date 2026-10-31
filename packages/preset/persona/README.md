---
title: "@deepseek-ai/dsh-persona"
tags: []
category: "preset"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-persona` 让单个 agent（智能体）拥有自己的人设：preset 挂载这一可组装的行来注册人设前缀与后缀段落，为该会话遮蔽部署级默认值。它还可以把前缀变成该会话的完整系统提示词、抑制所有其他段落，并可为该会话关闭动态 runtime-context 快照。请把它挂在 preset 组装内部——全局挂载会与提示词注册表自身的人设注册相撞并明确报错。没有这一行，preset 能改变 agent 的工具，却永远改不了它的身份。

---

## ⚡ 功能

### 限制

这些限制说明本行何时不合适。它们是当前包约束，不是任务积压。

- **不支持全局挂载**——提示词注册表拥有未加 scope 的人设槽位，因此本行只能从带 scope 的组装中使用。要改变部署级人设，应在 `system-prompt` 行自身的配置中修改。
- **runtime-context 抑制是全有或全无**——`includeRuntimeContext: false` 会关闭该作用域的所有上下文贡献，包括沙箱策略、批准策略与委派；没有按提供方过滤的选项。

---

## 📊 指标

### 人设段落

#### 模型看到什么

位于 order `0` 的 `deployment:persona-prefix` 段落携带本行的 `prefix`；位于 order `10200` 的 `deployment:persona-suffix` 在第一方指导之后携带其 `suffix`。两者分别替换对应的部署默认值，并解析提示词变量。在完整模式下，模型只会看到渲染后的前缀段落作为系统提示词。Runtime context 默认保持启用；禁用后，新建 agent 不会收到来自沙箱策略、批准策略、委派或其他 system-prompt 上下文提供方的 runtime-context 快照。

#### Token 影响

对给定 preset 而言是固定的：该 agent 的每次请求都携带人设前缀与后缀的 token，其他 agent 一个都不带。空文本不贡献任何 token。完整模式会移除该 agent 的其他所有系统提示词 token。

#### KV Cache 影响

渲染后的模板变量与文本不变时，前缀保持稳定。模型、前缀与工具一致时，后缀变化不改变前置指令。前缀变化会影响靠前的前缀；不保证提供方共享缓存。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

### 本行如何注册

本行使用注册表共享的名称与具名顺序来注册带作用域的人设前缀与后缀段落。两者分别遮蔽对应的部署默认值，而不是出现在其旁边；排序、插值与完整提示词执行归注册表所有。`includeRuntimeContext: false` 会调用 `ctx.systemPrompt.suppressRuntimeContext()`。

### 本行为何仅限 scope 内使用

`dsh-system-prompt` 以自身配置持有全局人设并无条件注册 `deployment:persona-prefix`，因此一个进程只有一份。本行在 agent scope 之外与该项注册相撞，这是刻意的：本行的存在是因为 preset 无法自行挂载提示词注册表。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config` schema、人设段落注册、runtime-context 抑制 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config` schema、人设段落注册、runtime-context 抑制 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面；它们从 preset 组装逐步进入本行所供给的提示词注册表。

- [agent-presets 包](../agent-preset-registry/README.zh.md)——本行挂载进的 preset 组装。
- [系统提示词子系统](../../../docs/subsystems/system-prompt.zh.md)——段落、组装，以及本行所遮蔽的人设槽位。
- [生成的配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-persona)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-persona'
  config:
    prefix: You are a terse systems engineer who answers in short commands.
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `prefix` | 必填 | 作为 `deployment:persona-prefix` 段落渲染的人设文本 |
| `suffix` | `''` | `deployment:persona-suffix` 模板；省略或空文本会遮蔽掉全局后缀 |
| `complete` | `false` | 仅将渲染后的前缀用作系统提示词；忽略后缀 |
| `includeRuntimeContext` | `true` | 是否为此 agent 作用域包含动态 runtime-context 快照；false 会抑制所有上下文贡献，但不禁用拥有它们的服务 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-persona
