---
title: "dsh-util-crypto"
tags: []
category: "util"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

零依赖、可在浏览器使用的 UUID 与字节编码辅助函数。UUID 铸造基于 `crypto.getRandomValues`——所有发布上下文都提供的那个随机原语。`crypto.randomUUID` 是安全上下文限定的 Web API：经普通 HTTP 在局域网地址上提供的页面或 worker（浏览器预览部署）根本没有这个方法，必须在那里运行的代码不能调它。全仓 `no-restricted-properties` lint 规则把 `crypto.randomUUID` 的调用者指到这里；只跑在 Node 的代码从 `node:crypto` 导入 `randomUUID` 维持原样。

---

## ⚡ 功能

### 限制

- **仅 v4**——不提供其他 UUID 版本、命名空间或解析；需要更多能力的消费方应引入真正的 UUID 依赖。
- **唯一性是概率性的**——122 位随机，与 `crypto.randomUUID` 同级保证；此处不做碰撞检测。

---

## 📊 指标

间接地，经由用它铸造请求、会话与附件标识符的消费方，这些标识符均不作为语义内容进入提示词。

#### KV Cache 影响

无直接失效；铸造标识符的消费方自行负责其请求变化。

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

**npm**: @deepseek-ai/dsh-crypto
