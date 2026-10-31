---
title: "@deepseek-ai/dsh-session-format-v3-to-v4"
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

在不改写已存储代际的前提下，将受支持的已发布 V3 Session 恢复为 V4。本页完整说明迁移边的转换、保留、前置证据与拒绝规则，再单独说明原生 V4 接纳。转换提升工具结果、重命名消息来源、补齐有明确证据的中断回合，并追加缺失的父目录事实。持久化层负责文件读取和后继代际发布；本库负责转换与目标规则。

---

## ⚡ 功能

### 限制

- **历史转换器覆盖范围** — 未支持的源表示可能拒绝迁移，不发布后继文件，也不修改源文件。一方录制不等于第三方扩展全集。V4 发布后，只要输出仍兼容 V4，后续转换器修复就可以增加支持。解释流起始块的额外字段或处理未来投递代际，应以具体格式变更为依据。
- **已接受 V4 转换**——[检查点](../../../docs/session-format-status.zh.md#finalization-record)保护已接受历史。向后兼容的新增可以通过新的确认记录保留 V4；破坏性变更要求后继版本。已写入的 V4 文件不会重跑此入边，历史输入保持不变。
- **V5 前置读取器**——V4 子日志证据目前经过已安装目录。后续写入器在改变该目录前，须绑定固定代际的 V4 前置读取。导出的 V4 恢复器提供代际自有检查；完整的通用消息接纳还使用已安装的 Session 校验。
- **历史嵌套工具结果**——当前迁移拒绝包含另一个 tool-result wrapper 的结果。原始代际保持完整，且不发布 V4 successor。后续转换器可以支持有证据的源数据场景，而不改变既定 V4 格式；[迁移 cookbook](../../../docs/cookbook/adding-a-session-format-version.zh.md#stages-and-validation) 定义了这一区别。
- **历史扩展消费者**——带前缀的消息与结果字段保留 JSON 数据，不激活核心字段。消费者必须明确理解这些字段后才能解释它们。
- **依赖保留的子日志**——仅凭父日志无法恢复未记录的子 id、创建时间或 descriptor。删除的子 Session 无法从工具参数恢复；已存在的父目录记录仍保留。
- **历史模式未知**——没有恰好一个受支持的自身 descriptor 时，缺失的父目录项记录未知模式。当前读取不重写该项；打开子会话时解析可用的 descriptor 信息，或报告该子会话的错误。
- **存储范围**——事实只覆盖同一持久化根目录内可识别的子 Session。跨根目录导入和损坏日志修复不属于此迁移。

---

## 📊 指标

### 历史恢复

#### 模型看到什么

历史请求保留记录的消息与模型配置。[迁移 Stage](src/migration.ts)将 `tool/result` 载荷表示为工具角色消息，不添加模型可见内容；目录记录不会直接进入模型消息，后续子代理列举可以发现历史子 Session。

#### Token 影响

转换不改变请求文本或承载 token 的数据。

#### KV Cache 影响

该迁移边保留记录的请求前缀。提供方缓存的可用性和淘汰策略不属于本库职责。

## 已知限制与待办工作

---

## 🏛️ 设计

<details>
<summary>实现内部机制 — 点击展开</summary>

迁移声明创建相互独立的流式 Stage。紧凑事件段通过迭代器展开，不生成中间事件数组。V3 到 V4 Stage 在发出 V4 事件时重写历史消息来源、提升历史工具结果包装，并插入有明确证据的中断回合结束事件。它为每个源事件保留一个源到目标的序号映射项，用于本地引用重映射。V4 编解码器只为物理头部和源范围分帧使用已发布 V2 编解码器，并直接校验原生工具角色行；它不会调用已发布 V3 校验器或源转换视图。JSONL 扫描器在抑制可恢复行之前调用 `assertV4RowAdmission`，并在返回完整逻辑前缀之前调用共用的强制关系校验器。

目标恢复器校验原生字段和强制跨事件关系，然后返回原始产物。未知的可忽略事件保持不透明，未完成的继承压缩事务在 end-seed 标记处结束。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [格式版本与发布状态](../../../docs/session-format-status.zh.md) — 当前检出写入版本与已发布格式的权威记录。
- [添加 Session 格式版本](../../../docs/cookbook/adding-a-session-format-version.zh.md) — 相邻迁移边的集成与校验。
- [JSONL 持久化](../session-persistence-jsonl/README.zh.md) — 不可变代际选择与发布。

---

## 🚀 快速开始

```ts
const targetHeader = sessionFormatV3ToV4.migrateHeader(sourceHeader)
```

```ts
const catalog = createSessionFormatCatalogWithChildren(childFacts)
const restore = catalog.createRestore(physicalHeader, {
  recovery: 'strict', validation: 'current',
})
for (const row of physicalRows) restore.decodeRow(row)
const artifact = restore.finish()
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-format-v3-to-v4
