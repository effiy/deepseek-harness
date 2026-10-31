---
title: "session/ — 持久会话数据平面"
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

session 组让对话持久保存，恢复已发布的日志格式，并使已提交历史在重启后仍可用。存储与检查点包保护请求、工具副作用和已完成步骤；投影包生成客户端可用的值；标题包为会话命名；遥测包上报活动。先使用随产品交付的 JSONL 存储，再添加检查点，并仅按部署需要添加投影、标题策略或遥测。每个包 README 负责各自的保证与配置，同级查询组则提供独立的读取和工具访问。

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

| 包 | 职责 | ctx key |
|---|---|---|
| [`session-format/`](session-format/README.zh.md) | 纯相邻格式链与产物校验库 | 库，不使用 ctx key |
| [`session-format-v0-to-v1/`](session-format-v0-to-v1/README.zh.md) | 冻结的 released-v0 解码器，以及到 released v1 的恒等迁移 | 库，不使用 ctx key |
| [`session-format-v1-to-v2/`](session-format-v1-to-v2/README.zh.md) | 冻结的 released-v1 解码器，以及迁移到 released v2 时会改变基数的 Assistant 流迁移 | 库，不使用 ctx key |
| [`session-format-v2-to-v3/`](session-format-v2-to-v3/README.zh.md) | 冻结的 V2 解码器，以及迁入 V3 的系统提示词、信封与 PTC 转换 | 库——无 ctx 键 |
| [`session-format-v3-to-v4/`](session-format-v3-to-v4/README.zh.md) | V3 恒等迁移与 V4 编解码器，按 generation 校验 delivery | 库——无 ctx 键 |
| [`session-format-catalog/`](session-format-catalog/README.zh.md) | 自动生成的已交付相邻迁移静态目录 | 库，不使用 ctx key |
| [`session-persistence/`](session-persistence/README.zh.md) | 定义持久会话存储服务，以及每个后端组合的共享写入协调机制 | `ctx.sessionPersistence` |
| [`session-persistence-jsonl/`](session-persistence-jsonl/README.zh.md) | 随产品交付的后端：逐 Session 使用不可变规范 generation 文件名并排他发布后继；可选 Zstandard 压缩 | 注册到 `ctx.sessionPersistence` |
| [`session-checkpoint-policy/`](session-checkpoint-policy/README.zh.md) | 让模型请求、顶层工具副作用与已完成步骤在下一步动作前持久化 | 包装 `ctx.llm` 与 `ctx.tools` |
| [`session-log-deepseek/`](session-log-deepseek/README.zh.md) | 把增量规范日志作为可选的官方 DeepSeek 请求元数据上传 | 贡献 `dsh_session_log` |

---

## 🔗 资源

- [会话持久化子系统](../../docs/subsystems/persistence.zh.md)——后端无关的服务语义、flush 检查点与崩溃恢复。
- [工作目录子系统](../../docs/subsystems/working-directory.zh.md) — 有效目录与恢复。
- [会话投影子系统](../../docs/subsystems/session-projection.zh.md)——投影单元约定与驱动语义。
- [会话标题子系统](../../docs/subsystems/session-title.zh.md)——标题资格、回退与提供方流程。
- [会话遥测子系统](../../docs/subsystems/session-telemetry.zh.md)——捕获、脱敏与投递模式。
- [会话子系统](../../docs/subsystems/session.zh.md)——本组每个包持久化或派生的实时事件日志。

实验性可选能力见 [`session-title-all-prompts-llm`](../experimental/session-title-all-prompts-llm/README.zh.md)。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
