---
title: "@deepseek-ai/dsh-tool-workspace-dependencies"
tags: []
category: "skill"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

自带脚本运行时的部署（Desktop 的 primary runtime，或容器镜像层）挂载本工具，让 agent 询问随包的 Python、Node.js 与 pnpm 在哪里，而不是自行寻找系统解释器。工具返回绝对路径与记录的发行版版本，不改 `PATH`，不改包管理器设置。payload 或在首次调用时复制到 Harness home 下（Desktop），或原地使用（只读载体）。

---

## ⚡ 功能

### 限制

- Linux 目标需要 glibc；尚未锁定 musl payload。
- Windows 上原地使用的 payload 须在载体里已可执行；原地模式不修复权限。

---

## 📊 指标

### 工具 schema

#### 模型看到什么

模型看到生成的 [`load_workspace_dependencies` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-workspace-dependencies)。

#### Token 影响

工具可见的每个请求固定一份 schema 开销；描述里列出了随包的 Office 库，模型不必先加载 skill 就能选择解释器。

#### KV 缓存影响

工具定义与可见性不变时前缀稳定。

### 工具结果

#### 模型看到什么

一个 JSON 对象：绝对路径 `python` 与 `pythonPackages`、来自 `runtime.json` 的 `pythonDistributions`，以及 payload 声明了才有的 `node`、`nodePackages` 与 `pnpm`。重复调用返回同一对象。

#### Token 影响

每次调用几百个字符，以路径为主。

#### KV 缓存影响

作为工具结果追加进轮次历史；不增加提示词分区。

## 已知限制与暂缓事项

---

## 🏛️ 设计

## 了解实现

<details>
<summary>实现细节——点击展开</summary>

`readPrimaryRuntime` 与构建冒烟检查共用 `parsePrimaryRuntime`。它校验扁平清单，拒绝归一化后重名的分发包。旧 `components` 元数据在内存中归一化，并保留旧格式的一致性校验；旧分发包版本表缺失时转换为空表。混用顶层与旧组件版本字段会被拒绝。读取不改写元数据，归一化后等价的清单可复用已安装产物。`workspaceDependencyPaths` 推导各平台的条目路径。`installPrimaryRuntime` 复制到暂存目录、要求声明的解释器和脚本为文件、库路径为目录、再换入正式位置，失败时保留旧树；`resolvePrimaryRuntime` 做同样的校验但不复制。工具在插件生命周期内记住首次成功的结果。

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 清单校验、路径推导、原地与安装两种准备方式、工具注册。 |

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

## 延伸阅读

- [Office skills](../skill-office/README.zh.md)——调用本工具取解释器的工作流。
- [工具注册表](../../core/tools/README.zh.md)——注册与 schema。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-tool-workspace-dependencies'
  config:
    source: /path/to/primary-runtime
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `source` | 必填 | 含 `runtime.json` 与 `dependencies/` 的 payload 绝对目录。 |
| `root` | 未设置 | Harness home 下的绝对安装目录。设置时首次调用把 payload 复制过去，`runtime.json` 不变则复用；未设置时校验后原地使用，不复制。 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-tool-workspace-dependencies
