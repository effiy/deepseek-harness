---
title: "@deepseek-ai/dsh-llm-deepseek-api-key"
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

为 `deepseek-official` 注册独立的鉴权和模型发现插件。通过 [llm-deepseek](../llm-deepseek/README.zh.md) 共用 Messages 请求实现；本包拥有凭据解析和目录可用性判断。

鉴权解析将验证后的 API key 放入 `x-api-key`，供 Messages 和 Files 请求共同使用。

---

## ⚡ 功能

### 限制

- 目录是配置元数据，不验证远端是否接受模型；实际调用仍可能失败。

---

## 📊 指标

### 已鉴权的模型请求

#### What the model sees

`deepseek-official` 请求不包含本插件添加的模型可见文本；请求由共享 Messages 传输序列化。

#### Token effect

鉴权和目录过滤不增加输入 token；实际调用的 token 由所选模型与请求内容决定。

#### KV Cache effect

凭据与目录可用性不进入模型输入；协议传输拥有请求前缀的序列化。

## 已知限制与后续工作

---

## 🏛️ 设计

注册和监听随插件生命周期释放。共享 Host 绑定提供附件访问、请求扩展、匿名标识和重试策略的原子更新；本包只注册自己的路由。

---

## 📁 目录

「待补充」

---

## 🔗 资源

[LLM streaming](../../../docs/subsystems/llm-streaming.zh.md) · [Messages](../llm-deepseek/README.zh.md)

---

## 🚀 快速开始

### 配置

```yaml
- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    reasoningEffort: high
    apiKeyEnv: DEEPSEEK_API_KEY
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-llm-deepseek-api-key
