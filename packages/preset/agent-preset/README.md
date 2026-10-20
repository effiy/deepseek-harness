---
title: "@deepseek-ai/dsh-agent-preset"
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

在普通 Cordis YAML 中定义 Agent 的子插件列表。可同时声明多个 preset，由会话选择。声明会提前加载，修改只影响之后创建的 Agent。

---

## ⚡ 功能

### 限制

- 需要 `agentPresets` 服务。重复的 preset ID 会导致声明加载失败。声明不提供目录、文件复制或文件删除操作。
- 从仓库发现 `agent-experience` 要求 checkout 启用符号链接。设置 `core.symlinks=false` 时，Git 会将链接目标写成纯文本，而不是 skill。创造模式使用包内的普通文件，不依赖该别名。

---

## 📊 指标

通过声明的插件间接影响模型，这些插件拥有模型可见工具和提示词。

#### KV Cache effect

同一 Agent 的组合保持稳定；新 Agent 可使用更新后的定义。

## 已知限制与待办

---

## 🏛️ 设计

<details>
<summary>实现细节 — 点击展开</summary>

[index.ts](src/index.ts) 注册定义并把清理函数交给 Cordis。插件的 group 标记保留子配置中的 `!!js`，直到对应子插件加载时才求值。代际持有与释放由 [注册表](../agent-preset-registry/README.zh.md) 管理。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

## 延伸阅读

- [Scope](../../core/scope/README.zh.md) — 注册隔离。
- [Agent](../../core/agent/README.zh.md) — 会话运行时。
- [Cordis](../../../docs/cordis-primer.zh.md) — 插件配置与生命周期。

---

## 🚀 快速开始

### 配置

```yaml
- id: agent-preset-registry
  name: '@deepseek-ai/dsh-agent-preset-registry'
  config:
    default: standard
- id: preset-standard
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: standard
    plugins: []
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `id` | 必填 | 稳定的 preset 标识符 |
| `plugins` | 必填 | 子插件行列表 |
| `name` | 未设置 | 展示名称 |
| `description` | 未设置 | 展示说明 |
| `order` | 未设置 | 列表排序 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-agent-preset
