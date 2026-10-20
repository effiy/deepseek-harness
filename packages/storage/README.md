---
title: "packages/storage"
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

存储组跨重启保留非会话应用数据，包括工作区记录和会话伴随数据。需要人类可读文件时选择 `storage-json`，需要在单个数据库中定点更新时选择 `storage-sqlite`；`storage-domain` 增加经过 schema 校验的类型化记录和变更通知，而 `storage` 选择已配置的后端。这些包是可选项且只面向宿主侧：它们不会向模型暴露工具、提示词内容或会话事件。当应用状态必须在进程结束后继续存在时使用本组；组合没有此类数据时可以省略本组。

---

## ⚡ 功能

「待补充」

---

## 📊 指标

「待补充」

---

## 🏛️ 设计

「待补充」

---

## 📁 目录

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`storage`](storage/README.zh.md) | 把已注册后端与已挂载的数据形式设施连接起来 | `ctx.storage` |
| [`storage-json`](storage-json/README.zh.md) | 把每个单元存为一个人类可读的 JSON 文件 | 注册后端 `json` |
| [`storage-sqlite`](storage-sqlite/README.zh.md) | 把单元作为 JSON 文档存进一个 SQLite 数据库 | 注册后端 `sqlite` |
| [`storage-domain`](storage-domain/README.zh.md) | 在已路由后端之上提供经过 schema 校验、发出变更事件的 KV 领域 | `ctx.storageDomain` |

---

## 🔗 资源

- [存储子系统](../../docs/subsystems/storage.zh.md)——权威约定：后端约定、领域声明、变更事件与生成的 API。
- [领域 KV 存储 Agent Note](../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.zh.md)——本家族的设计、workspace 消费方与被推迟的会话后端迁移。
- [Workspace 子系统](../../docs/subsystems/workspace.zh.md)——领域数据形式的第一个消费方。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
