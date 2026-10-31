---
title: "@deepseek-ai/dsh-agent-preset-registry"
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

通过声明式 preset 选择 Agent 的工具、提示词和技能。同一进程可以运行多种组合。配置失败会显示在列表中；现有 Agent 保留已经使用的组合。

---

## ⚡ 功能

### 限制

- preset 不是安全沙箱：YAML 及插件可以执行 Host 代码。用户覆盖替换完整子插件列表，不自动合并内置列表的未来更新。进程退出后不保存旧代际的插件实现。

---

## 📊 指标

### Preset 选择

#### 模型看到的内容

没有直接内容：所选 preset 的 `plugins` 拥有模型可见的工具和提示词片段。

#### Token 影响

本包自身没有；每个挂载的 `plugins` 行声明自己的工具和片段。

#### KV Cache effect

已有 Agent 保留插件和提示词。新 Agent 从当前定义构建前缀。

## 已知限制与待办

---

## 🏛️ 设计

<details>
<summary>实现细节 — 点击展开</summary>

每个声明在启动时创建注册表拥有的 scope 和内存 Loader 树。更新或移除声明会让旧代际退役；Agent、子 Agent 和临时历史读取各自持有引用，最后一个引用释放后才销毁插件树。插件注册继承 preset scope，Agent scope 的父链接决定可见性；Agent loop 仍由宿主共享。

preset 的服务提供方及其消费方必须共享同一个 `cordis:group` 隔离 realm。条目局部隔离不会沿 Agent 注册 scope 传播：组外的普通 Context 查找（包括 `agent.ctx`）仍选择 Host realm。`agentPresets.serviceFor()` 显式检查保留的组合，不改变普通服务查找。

激活审计检查导入失败、缺失服务和向全局泄漏的服务。导入失败、激活失败和泄漏会拒绝挂载。等待 Host 服务的行保持挂载，每次读取和绑定都在 Host Loader 树结算后重新审计，因此启动顺序不决定结果。失败只禁用该定义的新绑定。会话日志保存 preset ID 和空白会话的切换记录；重启恢复使用该 ID 的当前定义，缺失时拒绝恢复。

`inspectCompositions()` 读取本注册表仍保留的全部代际；传入 Agent 上下文时只选择它绑定的精确代际，在此没有绑定时返回空列表。每个 `AgentPresetInspection` 包含 preset ID、纯数据形式的活动模块引用及解析基址，以及泄漏的服务名。检查器查询运行中的服务，而不是模块级挂载表；结果不包含 Loader 树或 fiber。这些记录定义在 [composition-inventory.ts](src/composition-inventory.ts) 中。

| 文件 | 职责 |
|---|---|
| [index.ts](src/index.ts) | 注册、代际与 Agent 绑定 |
| [mount.ts](src/mount.ts) | 隔离插件树与激活审计 |

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
| `default` | 必填 | 未显式指定时使用的 preset ID |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-agent-preset-registry
