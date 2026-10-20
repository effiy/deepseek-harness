---
title: "@deepseek-ai/dsh-llm-deepseek-account"
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

为 `deepseek-account` 注册独立的鉴权和模型发现插件。通过 [llm-deepseek](../llm-deepseek/README.zh.md) 共用 Messages 请求实现；本包拥有凭据解析和目录可用性判断。

鉴权解析返回 `x-dsh-auth-token` 和捕获同一 token 的失败回调。HTTP 401 的分类和凭据失效处理由此提供方负责；被拒绝的旧请求不能清除替换后的登录。

---

## ⚡ 功能

### 限制

- 目录是配置元数据，不验证远端是否接受模型；实际调用仍可能失败。

---

## 📊 指标

### 已鉴权的模型请求

#### What the model sees

`deepseek-account` 请求不包含本插件添加的模型可见文本；请求由共享 Messages 传输序列化。

#### Token effect

鉴权和目录过滤不增加输入 token；实际调用的 token 由所选模型与请求内容决定。

#### KV Cache effect

凭据与目录可用性不进入模型输入；协议传输拥有请求前缀的序列化。

## 已知限制与后续工作

---

## 🏛️ 设计

注册和监听随插件生命周期释放。共享 Host 绑定提供附件访问、请求扩展、匿名标识和重试策略的原子更新；本包只注册自己的路由。

共享传输判定为 `QUOTA` 的失败请求离开本提供方前会被改写为 `ACCOUNT_QUOTA`，HTTP 402 响应与流内 SSE 错误都适用。共享传输与 `deepseek-official` 路由保留 `QUOTA`，因此账号路由的充值操作不会出现在 API Key 或第三方失败上。

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
- id: llm-deepseek-account
  name: '@deepseek-ai/dsh-llm-deepseek-account'
  config:
    reasoningEffort: high
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-llm-deepseek-account
