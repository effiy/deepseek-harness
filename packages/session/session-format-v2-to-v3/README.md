---
title: "@deepseek-ai/dsh-session-format-v2-to-v3"
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

将受支持的已发布 V2 会话恢复为 V3，同时保留历史请求含义。本页是这条相邻迁移边的单一规范真源：先说明转换、保留与拒绝的内容，再单独说明原生 V3 准入。本库将系统提示词提升为消息，重映射本地事件引用，转换 PTC 与预设名称，并规范化信封。持久化通过静态目录使用本库；本库不读取或发布文件。

---

## ⚡ 功能

### 限制

- **历史预设歧义** — 已发布 `code` 引用无法区分与旧内置标识同名的自定义预设；[精确重命名](#header-and-presets)不依赖宿主。
- **不迁移文件或设置** — 本包绝不修改已提交代或 `settings.yaml`。持久化负责发布最终后继代；已有 V3 代不重新运行其入边。格式发布状态见[状态记录](../../../docs/session-format-status.zh.md)，兼容性义务见[已发布格式策略](../../../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.zh.md)。

---

## 📊 指标

### 历史日志恢复

#### 模型看到什么

每个历史请求保留其提示词文本与普通消息内容。空系统头节点不产生模型消息。PTC 归属使用 `tools-ptc`；分发事件仍仅写日志。

#### Token 影响

迁移边不添加模型可见文本；它将已记录的提示词从请求头移入消息历史。

#### KV Cache 影响

迁移边保留历史请求含义与模型配置；它不保证提供方缓存命中，也不保证与原生 V3 录制字节相同。

## 已知限制与后续工作

---

## 🏛️ 设计

<details>
<summary>实现细节 — 点击展开</summary>

[阶段](src/migration.ts)拥有每份产物独立的同步序列映射、消息身份集合和提示词/生命周期状态。紧凑事件段增量展开。[编解码器](src/codec.ts)复用冻结的 V2 分帧；[恢复器](src/validation.ts)先校验 V3 结构，再向冻结的普通关系校验提供私有 system/PTC/修复标识与端点视图。该视图为投递检查保留实际目标代次，且绝不对外返回：恢复返回原始 V3 产物与身份。冻结的 V0 到 V1 和 V1 到 V2 语义保持不变。

[组合目录测试](tests/combined-migration.spec.ts)验证转换组合与原生重新打开；[迁移测试](tests/migration.spec.ts)和[规范测试](tests/canonical-envelopes.spec.ts)固定保留与拒绝规则。[持久化集成](../session-persistence-jsonl/tests/v2-ptc-migration.spec.ts)负责发布证据。[已发布格式决策](../../../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.zh.md)负责将相邻组合测试与原生准入测试分开的依据。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

## 深入探索

- [已发布 V1 到 V2](../session-format-v1-to-v2/README.zh.md) — 冻结的前代转换与源编解码器。
- [系统提示词 surface 决策](../../../.agents/notes/implemented/architecture/2026-09-02-system-prompt-as-surface-node.zh.md) — 提示词归属与头节点保护依据。
- [规范 V3 信封决策](../../../.agents/notes/implemented/architecture/2026-09-06-v3-canonical-session-envelopes.zh.md) — 严格准入与校验归属。

---

## 🚀 快速开始

```ts
const targetHeader = sessionFormatV2ToV3.migrateHeader(sourceHeader)
```

使用场景

使用[目录](../session-format-catalog/README.zh.md)恢复会话。直接导入用于目录组装和测试；本库没有 Cordis 挂载配置。[公共导出](src/index.ts)提供迁移声明、已发布 V2 源编解码器、V3 目标编解码器、目标头校验器和目标恢复器。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-format-v2-to-v3
