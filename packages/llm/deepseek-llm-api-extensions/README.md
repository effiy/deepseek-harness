---
title: "@deepseek-ai/dsh-deepseek-llm-api-extensions"
tags: []
category: "llm"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

用于向 DeepSeek 官方 LLM（大语言模型）API 请求添加顶层字段的提供方特定注册表。`DeepSeekLlmApiExtensionRegistry` 注册 `ctx.deepseekLlmApiExtensions`；贡献插件分别认领一个经声明合并的字段，`dsh-llm-deepseek` 则在序列化基础请求后准备当前贡献。当插件必须添加经过验证的提供方特定字段且不能修改基础适配器时，请使用它。

---

## ⚡ 功能

### 限制

- **仅限 DeepSeek 官方请求**——该注册表刻意不提供提供方无关的路由，也不集成 pi-ai 适配器。
- **不约定字段顺序**——JSON 对象成员顺序取决于注册准备顺序，但接收方按名称寻址字段。

---

## 📊 指标

通过 `@deepseek-ai/dsh-llm-deepseek` 间接生效；该包在模型的 `messages`、系统提示词与工具 schema 之外发送已注册字段。

#### KV Cache 影响

无；注册表字段是模型不可见的提供方元数据，不改变已序列化的模型输入前缀。

## 已知限制与暂缓事项

---

## 🏛️ 设计

「待补充」

---

## 📁 目录

「待补充」

---

## 🔗 资源

「待补充」

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-deepseek-llm-api-extensions
