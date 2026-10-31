---
title: "@deepseek-ai/dsh-storage-json"
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

`dsh-storage-json` 在配置的根目录下把领域数据存为可读 JSON，并注册为后端 `json`。默认的 `single` 布局为每个单元保存一份完整的 `<unit>.json` 文件；`per-record` 布局为每条记录保存一份带版本戳的文档。两种布局都以原子方式发布每个变更文件，领域层负责安排调用顺序。当运维方需要可检查文件且所选布局适合写入量时选择它；对于更大或高并发的数据则选择 SQLite。本后端只面向宿主侧，不贡献提示词、工具或 schema。

---

## ⚡ 功能

### 适用场景

小型单元需要一份完整、美化打印的文件时，选择默认的 `single` 布局。定点写入只应替换一份记录文档时，选择 `per-record`。当数据量大、写入频繁或多条记录需要事务更新时，选择 SQLite 后端。

### 限制

这些限制说明本后端何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是任务积压。

- **`single` 会重写整个单元**——每次写入都重新发布完整单元文件；当此成本过高时，使用 `per-record` 或把领域路由到 SQLite。
- **没有跨进程写锁**——两个进程写入同一单元时可能交错执行替换；对同一文件的写入以最后完成者为准。
- **Windows rename 没有显式 write-through**——持久性依赖 libuv 的 `rename()`（`MoveFileExW` 并启用替换）；`log` 分面落地时，计划把会话日志后端更严格的 Win32 write-through 发布辅助函数下移到此处。

---

## 📊 指标

### 已存领域记录

#### 模型看到什么

无。本后端不贡献提示词、工具或 schema；它在 `ctx.storage` 后面持久化非会话领域数据，只供宿主侧消费方使用。

#### Token 影响

实时请求 token 为零。

#### KV Cache 影响

无：本后端从不触碰实时请求前缀。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

两种布局共享原子发布机制，但以不同方式确定状态所有权。`single` 拥有一份内存单元投影；`per-record` 把目录树视为权威状态。

### 设计理念

- **`single` 以内存为权威状态。** 每次写入都会更改内存单元、序列化其完整状态，并以原子方式替换 `<unit>.json`。发布失败会恢复先前的内存值。
- **`per-record` 以目录为权威状态。** 每次 put 或 delete 都会更改一个 `<unit>/<table>/<key>.json` 文档，`loadAll()` 则重新读取目录树。每份文档都带有单元版本戳与一条记录值。
- **每次调用都持久发布。** 写入过程使用临时文件、fsync、原子 `rename()` 替换，并在 POSIX 上 fsync 父目录。领域层写入链负责安排跨调用的顺序。

### 文件格式

`single` 文档携带单元标识、全局单例与所有表：

```json
{
  "unit": { "name": "workspace", "version": 1 },
  "global": null,
  "tables": { "workspaces": { "<key>": { "path": "/work/demo" } } }
}
```

`per-record` 表文档位于 `<root>/<unit>/<table>/<key>.json`，形式为 `{ "version": 1, "record": <value> }`；可选的全局值使用 `<root>/<unit>/global.json`。格式版本来自领域规范。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：后端注册、`root` 配置、单元打开／关闭表 |
| [`src/single-unit.ts`](src/single-unit.ts) | 一个 `single` 单元：权威内存、写入原语与发布回滚 |
| [`src/per-record-unit.ts`](src/per-record-unit.ts) | 一个 `per-record` 单元：目录树读取、路径安全记录与单文档写入 |
| [`src/format.ts`](src/format.ts) | 带版本校验的整单元与记录序列化 |
| [`src/atomic.ts`](src/atomic.ts) | 原子文件替换：临时文件写入、fsync、rename、目录 fsync |

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

Agent Note 把整单元重写的规模前提标记为风险：如果在被路由到 SQLite 之前，第二个消费方以千条记录规模落到本后端，重写成本会比预期更早显现。缓解办法是配置——把 `routes` 指向 SQLite 后端——而不是修改本包。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：后端注册、`root` 配置、单元打开／关闭表 |
| [`src/single-unit.ts`](src/single-unit.ts) | 一个 `single` 单元：权威内存、写入原语与发布回滚 |
| [`src/per-record-unit.ts`](src/per-record-unit.ts) | 一个 `per-record` 单元：目录树读取、路径安全记录与单文档写入 |
| [`src/format.ts`](src/format.ts) | 带版本校验的整单元与记录序列化 |
| [`src/atomic.ts`](src/atomic.ts) | 原子文件替换：临时文件写入、fsync、rename、目录 fsync |

---

## 🔗 资源

当本后端视角不够用时阅读以下页面：子系统参考是权威约定，兄弟后端展示了另一种介质。

- [存储子系统](../../../docs/subsystems/storage.zh.md)——后端约定、领域语义与生成的 API。
- [存储包映射](../README.zh.md)——家族的各包及其在仓库中的位置。
- [SQLite 存储后端](../storage-sqlite/README.zh.md)——面向高频数据的定点更新介质。
- [领域 KV 存储 Agent Note](../../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.zh.md)——后端家族背后的设计及其延期工作。

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

| 字段 | 默认值 | 含义 |
|---|---|---|
| `root` | 必填 | 保存 `<unit>.json` 文件与 `<unit>/` 目录树的目录；按需以 `0o700` 创建 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-storage-json
