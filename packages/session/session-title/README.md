---
title: "@deepseek-ai/dsh-session-title"
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

使用 `dsh-session-title` 为每个会话提供客户端可见标题，标题可以来自第一条符合条件的用户消息、可选异步生成器或显式用户重命名。已接受的标题在回放、恢复与分页后仍然存在，但绝不会进入模型输入。自动生成绝不会延迟主 agent（智能体）响应，较新的标题请求会取代旧工作。当客户端需要带可配置长度上限的持久标题，以及通过 `refresh()` 主动重新生成标题的路径时，请选择本包。

---

## ⚡ 功能

### 限制

这些限制说明标题服务不提供什么。它们是当前包约束。

- **没有标题删除、搜索或列表索引**——不经显式 `refresh` 就解钉回自动标题、搜索与列表索引不属于此服务。
- **至多一个提供方**——注册表有意只接受一个实现，因此部署若要组合相互竞争的标题策略，必须编写一个自行负责优先级的提供方。

---

## 📊 指标

### 会话标题状态

#### 模型看到什么

无。`session/title` 只写入日志，绝不会进入会话接口、`deriveMessages()`、系统提示词、工具 schema 或请求前缀。

#### Token 影响

回退与已接受的提供方修订不会向主 agent 请求增加 token。可选提供方的独立辅助请求由对应提供方包的文档说明。

#### KV Cache 影响

不影响主请求；标题事件不会改变其重建内容或缓存键。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释标题设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

标题是持久的、仅写入日志的状态：每个已接受的修订都是 `session/title` 事件，`foldSessionTitle()` 选择最新事件，因此标题像任何其他会话事件一样在回放、恢复与分页中存活。服务拥有调度、取代与接受；提供方负责生成。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务：配置、折叠、回退调度、提供方注册表、并发、`title` 投影单元 |
| [`src/normalize.ts`](src/normalize.ts) | 标题文本清洗、UTF-8 安全截断与确定性回退 |
| [`src/types.ts`](src/types.ts) | `title` 投影键声明的归属位置 |

### 生命周期与并发

每个会话的工作状态维护一个修订计数器、一个进行中的回退，以及待处理与活跃的提供方工作。较新的用户消息、提供方 dispose（资源释放）、会话 dispose 或显式刷新都会通过 `AbortController` 中止旧工作；提供方、修订、会话或信号已陈旧的完成结果无法追加。显式刷新会在提供方工作之前预留修订号；重叠的自动／显式回退请求共享一个会话本地正在进行的追加操作。服务拆卸会取消排队工作，并在卸载完成前等待不响应取消的调用结算。

### 规范化

已接受标题会清除终端控制序列、方向性与不可见控制符以及非空白的 C0/C1 控制符；空白被规范化，按字节上限截断时绝不切断 Unicode 码点。确定性回退在 `fallbackMaxWords` 与 `fallbackMaxBytes` 内取第一条符合条件消息的开头若干词。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务：配置、折叠、回退调度、提供方注册表、并发、`title` 投影单元 |
| [`src/normalize.ts`](src/normalize.ts) | 标题文本清洗、UTF-8 安全截断与确定性回退 |
| [`src/types.ts`](src/types.ts) | `title` 投影键声明的归属位置 |

---

## 🔗 资源

当服务约定不够用时阅读以下页面。它们从子系统参考逐步进入在此插拔的模型支持提供方。

- [会话标题子系统](../../../docs/subsystems/session-title.zh.md)——持久标题状态与提供方词汇类型。
- [共享 LLM 执行模块](../session-title-llm/README.zh.md)——两个随附提供方共用的模型执行模块。
- [首消息标题提供方](../session-title-first-prompt-llm/README.zh.md)——根据第一条符合条件的用户消息生成标题。
- [全消息标题提供方](../../experimental/session-title-all-prompts-llm/README.zh.md)——根据所有符合条件的用户消息生成标题。
- [会话包映射](../README.zh.md)——相邻的持久化、投影、标题与遥测包。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-session'
- name: '@deepseek-ai/dsh-session-title'
  config:
    fallbackMaxWords: 8
    fallbackMaxBytes: 96
    maxTitleBytes: 120
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `fallbackMaxWords` | 必填 | 确定性回退中以空白分隔的最大词数 |
| `fallbackMaxBytes` | 必填 | 回退允许的最大 UTF-8 字节数；不得超过 `maxTitleBytes` |
| `maxTitleBytes` | 必填 | 接受任何来源标题的最大 UTF-8 字节数 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-title
