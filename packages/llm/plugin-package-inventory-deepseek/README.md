---
title: "@deepseek-ai/dsh-plugin-package-inventory-deepseek"
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

用于 DeepSeek 官方 LLM API 请求的尽力收集型活跃 Loader 插件包清单。该函数插件注入 Loader、存活 Agent 注册表与 `ctx.deepseekLlmApiExtensions`，并拥有 `dsh_plugin_packages` 字段。当官方 API 需要活动包清单进行请求诊断时，请启用它。

---

## ⚡ 功能

### 限制

- **仅含 Loader 包来源**——以编程方式创建的子 fiber 与内存动态插件没有权威 NPM 名称／版本来源，因此不在该清单内。
- **省略不可用身份**——包元数据不可用时，清单可能不完整。
- **原地替换包需要重启**——manifest 身份会在进程存活期内缓存。Loader 的启用、禁用、挂载、卸载与普通源码 HMR 仍会刷新存活配置项集合，但在同一进程中把已挂载包的 manifest 替换为另一版本并不是受支持的升级路径。

---

## 📊 指标

### 包清单元数据

#### 模型看到的内容

无。`dsh_plugin_packages` 是位于模型消息、系统提示词与工具 schema 之外的提供方元数据。

#### Token 影响

模型输入 token 为零；完整清单只会增加 HTTP 请求字节数。

#### KV Cache 影响

无；包生命周期变化不会改变模型可见前缀。

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

**npm**: @deepseek-ai/dsh-plugin-package-inventory-deepseek
