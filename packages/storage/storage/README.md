---
title: "@deepseek-ai/dsh-storage"
tags: []
category: "storage"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用 `dsh-storage` 持久保存类型化应用数据，而不将其加入会话历史。将它与受支持的存储介质和领域配置一同挂载后，调用方即可通过公共 `ctx.storageDomain` API 访问记录。工作区记录、会话伴随数据或其他必须在重启后保留且不应成为会话事件的应用状态适合使用它。它仅供宿主代码使用，对模型没有可见影响；无需此类数据的组合可以省略它。

---

## ⚡ 功能

### 限制

这些限制定义了枢纽不能做什么。它们是当前包约束，不是任务积压。

- **`kv` 是唯一的数据形状**——后端只实现一个分面；面向会话事件日志的 `log` 分面被推迟到会话后端迁移（[Agent Note](../../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.zh.md)）。
- **数据形式按需解析**——在领域插件挂载前读取 `ctx.storage.domain` 会抛出 `form-not-mounted`；组装会按相应顺序排列插件，而不是静默推迟。

---

## 📊 指标

### 后端与形式注册

#### 模型看到什么

无。`ctx.storage` 是宿主侧注册表：枢纽不注册工具、不注入提示词，也不写入会话事件，因此任何请求字段都不会携带本包的数据。

#### Token 影响

每次请求都不会直接增加 token。

#### KV Cache 影响

与实时请求相互独立：枢纽绝不触碰请求前缀，因此无法使提供方缓存复用失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

枢纽是一张纯注册表，拥有两个面，设计目标是后端与数据形式可以独立替换，而枢纽无需了解它们的内部实现。

### 设计理念

- **后端拥有介质，数据形式拥有语义。** 枢纽从不执行 IO；它只持有名称 → 后端表和形式名 → 设施表。后端包注册其介质所有者，数据形式包挂载其设施，双方都不需要对方的细节。
- **多个后端并排共存。** 哪个后端服务哪个消费方由消费方自身的配置决定（领域数据形式的路由表），绝非枢纽全局的二选一。
- **注册与挂载都是 effect。** `register()` 与 `mount()` 返回资源释放函数；释放只移除该次注册的贡献，且不会关闭后端——由所属插件在注销后关闭。
- **激活不会与注册竞争。** 每个后端插件还会发布一个仅用于生命周期的服务键（`storage.backend.<name>`）；数据形式提供方注入这些键，因此领域数据形式只在所有已配置后端注册后激活，而调用方仍通过枢纽按名称解析后端。

### 后端约定

[`src/backend.ts`](src/backend.ts) 是后端实现者的规范性约定，由 `tests/contract.ts` 中的共享一致性套件逐条款检查。一个后端只拥有一种介质，并暴露可选的数据形状分面；`kv` 是唯一的分面，打开单元即可获得一个带版本、全局单例的 schema 句柄，其每次调用均具备原子性，并在完成时保证持久化。单元名与表名必须匹配 `UNIT_NAME_RE`；记录键是任意字符串，绝不进入文件路径。单元不对并发写入做串行化——顺序由调用方负责——介质上记录的版本与描述符不同时拒绝 `version-mismatch`（不做迁移）。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Storage` 服务、数据形式挂载、`StorageForms` 表 |
| [`src/registry.ts`](src/registry.ts) | `BackendRegistry`：名称 → 后端表、注册资源释放函数 |
| [`src/backend.ts`](src/backend.ts) | 后端约定：分面、单元、`UNIT_NAME_RE` |
| [`src/error.ts`](src/error.ts) | 枢纽与每个后端共享的 `StorageError` 代码 |
| [`tests/contract.ts`](tests/contract.ts) | 针对每个后端运行的共享一致性套件 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Storage` 服务、数据形式挂载、`StorageForms` 表 |
| [`src/registry.ts`](src/registry.ts) | `BackendRegistry`：名称 → 后端表、注册资源释放函数 |
| [`src/backend.ts`](src/backend.ts) | 后端约定：分面、单元、`UNIT_NAME_RE` |
| [`src/error.ts`](src/error.ts) | 枢纽与每个后端共享的 `StorageError` 代码 |
| [`tests/contract.ts`](tests/contract.ts) | 针对每个后端运行的共享一致性套件 |

---

## 🔗 资源

当枢纽视角不够用时阅读以下页面：子系统参考是权威约定，Agent Note 记录了家族设计与延期工作。

- [存储子系统](../../../docs/subsystems/storage.zh.md)——后端约定、领域语义、变更事件与生成的 API。
- [存储包映射](../README.zh.md)——家族的各包及其在仓库中的位置。
- [领域 KV 存储 Agent Note](../../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.zh.md)——枢纽、领域数据形式与会话后端迁移背后的设计。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-storage'
- name: '@deepseek-ai/dsh-storage-json'
  config:
    root: /var/lib/dsh/data
- name: '@deepseek-ai/dsh-storage-domain'
  config:
    backend: json
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Storage` 服务、数据形式挂载、`StorageForms` 表 |
| [`src/registry.ts`](src/registry.ts) | `BackendRegistry`：名称 → 后端表、注册资源释放函数 |
| [`src/backend.ts`](src/backend.ts) | 后端约定：分面、单元、`UNIT_NAME_RE` |
| [`src/error.ts`](src/error.ts) | 枢纽与每个后端共享的 `StorageError` 代码 |
| [`tests/contract.ts`](tests/contract.ts) | 针对每个后端运行的共享一致性套件 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-storage
