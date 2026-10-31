---
title: "@deepseek-ai/dsh-session-log-deepseek"
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

用于 DeepSeek 官方 LLM（大语言模型）API 请求的增量规范会话日志上传。该函数插件注入 `ctx.sessions` 与 `ctx.deepseekLlmApiExtensions`，并拥有 `dsh_session_log` 请求字段以及用于派生接受水位的持久 `session-log-deepseek/delivery-accepted` 事件。仅当官方 API 不得接收会话日志后缀时才禁用它。

---

## ⚡ 功能

### 限制

- **崩溃窗口重复**——2xx 后、接受水位持久化前进程终止，会在恢复时触发保守重放。
- **缺少存活会话就没有字段**——直接调用或陈旧会话调用没有可供快照的规范日志；显式缺失语义仍暂缓处理。
- **超限事件会让上传停住**——字段单独就超过 `maxBytes` 的事件不会发送，后续事件也排在它后面，直到上限调高；根本无法序列化的事件会一直阻塞上传。
- **提供方拒绝会让请求失败**——提供方因该字段拒绝请求时，模型请求失败，游标保持不变，而非截断日志。

---

## 📊 指标

### 会话日志元数据

#### 模型看到的内容

无。`dsh_session_log` 是 DeepSeek 请求中模型输入字段的同级字段，不会插入 `messages`、系统提示词或工具 schema。

#### Token 影响

模型输入 token 为零；该字段只会增加 HTTP 请求字节数，且受 `maxBytes` 限制。

#### KV Cache 影响

无；模型可见请求前缀保持不变。

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

**npm**: @deepseek-ai/dsh-session-log-deepseek
