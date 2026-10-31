---
title: "@deepseek-ai/dsh-session-projection-cache"
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

本包保存持久的逐会话投影检查点，让历史列表、统计信息与 goal 快照无需加载每个会话日志即可读取缓存值。冷投影折叠可从已检查点化的前缀之后继续，从而减少重启后的工作量。会话日志始终是权威：崩溃可能使检查点陈旧，但不会使其领先于已提交事件；不兼容记录会被忽略或备份。当重启的会话需要频繁读取投影时选择本包；当投影只服务活会话，或额外存储写入与无限增长的检查点保留成本超过节省的工作量时跳过本包。

---

## ⚡ 功能

### 适用场景

当部署会重启会话，并需要为历史列表、统计信息或 goal 快照提供持久投影值时，选择本包。当投影只服务活会话，或额外存储写入的成本高于所节省的投影工作时，跳过本包。

### 限制

这些限制说明缓存何时需要运维注意。它们是当前包约束，不是任务积压。

- **无淘汰或保留接口**——记录按会话持续累积；清理已存储检查点属于带外维护，与会话持久化采用相同策略。
- **间隔节流采用按会话的粗粒度控制**——一次无脏数据的写入完成后，计时器在首个脏事件到达时启动；持续但低于条数阈值的事件流每间隔写入一次，而非滑动窗口。
- **缓存侧不做冷重折叠**——缓存只服务并刷新自己的记录，从不读取会话日志，因为它不依赖持久化层；需要保证冷快照的消费方自行从日志重新折叠。
- **每次 schema 或域版本变更都必须论证升级路径**——改动存储记录 schema 或域版本时，同一 PR 必须在 `tests/fixtures/` 下归档此前已发布磁盘格式的 fixture（测试前置数据），并在 `tests/fixtures.spec.ts` 中用测试论证所选的处置方式：读兼容恢复（`compatibleVersions`）、当前版本重写，或 backup-and-skip 抢救。即便选择直接丢弃旧记录的 bump，也要证明丢弃既不会导致启动失败，也不会污染缓存树。

---

## 📊 指标

无，因为持久缓存只加速主机侧的投影状态读取，不注册任何模型可见内容。

#### KV Cache 影响

无；缓存从不组装或发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节说明缓存的持久性与存储所有权；可观察行为已在[使用本包](#use-this-package)中说明。

### 设计理念

缓存是投影注册表检查点接口上的折叠捷径，存于 `per-record` 领域数据表中。它带来六项后果：读取绝不绕过领域写入链；每次后台写入都 fail-soft；`ver` 不匹配时丢弃而不迁移记录；记录必须通过当前运行单元的 `stateSchema`；写入通过无损 JSON 边界替换一份完整会话记录；日志领先，缓存跟随。

### 读写所有权

缓存在 `session_projcache` 领域中为每个会话保存一份带版本戳的文档。它不依赖会话持久化后端，不调用 `locate`，也不检查逐会话目录。畸形或陈旧的记录读作不存在；需要冷值的消费方负责提供日志以重新折叠。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SessionProjectionCache` 服务、后台写入监听器、缓存读取 |
| [`src/spec.ts`](src/spec.ts) | `session_projcache` 域 spec 与记录身份类型 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SessionProjectionCache` 服务、后台写入监听器、缓存读取 |
| [`src/spec.ts`](src/spec.ts) | `session_projcache` 域 spec 与记录身份类型 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从缓存逐步进入它检查点化的注册表与保存其记录的存储域。

- [会话投影子系统](../../../docs/subsystems/session-projection.zh.md)——本缓存检查点化的投影单元约定与驱动语义。
- [会话投影注册表](../session-projection/README.zh.md)——本缓存持久化其检查点的 `ctx.sessionProjections` 服务。
- [存储子系统](../../../docs/subsystems/storage.zh.md)——保存缓存记录的领域路由与后端行为。
- [会话包映射](../README.zh.md)——相邻的持久化、标题与遥测包。
- [会话投影 RFC](../../../.agents/notes/proposed/architecture/2026-07-27-session-projection-and-command-log.zh.md)——持久投影缓存的设计理由。

---

## 🚀 快速开始

### 配置

```yaml
- id: session-projection-cache
  name: '@deepseek-ai/dsh-session-projection-cache'
  config:
    writeEveryEvents: 200
    writeIntervalMs: 5000
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `writeEveryEvents` | 必填 | 在各必写点之间强制一次持久检查点写入的每会话已提交事件数 |
| `writeIntervalMs` | 必填 | 各必写点之间脏检查点最长可保持未写入的时间 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-projection-cache
