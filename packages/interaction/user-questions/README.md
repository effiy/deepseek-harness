---
title: "@deepseek-ai/dsh-user-questions"
tags: []
category: "interaction"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

当工具或权限流程需要用户提供结构化答案时，使用 `ctx.userQuestions`。`ask()` 会等待回答；`askTimed()` 可以放行 agent 继续独立工作，而问题仍留在会话中供用户回答。

---

## ⚡ 功能

### 限制

- **带 Agent scope 的 Web 回答**：Remote Events 仅在请求带有存活 Agent scope 时路由随产品交付的 Web 回答者；agentless 调用方需要本地未限定 scope 的 waterfall listener。
- **词汇仅包含问题表单形态**：可供选择的选项加可选的自定义文本；更丰富的交互形态（文件选择器、diff 预览确认）尚无 seam 词汇。
- **草稿文本不属于 Host 问题持久化状态**：问题通过 projection 跨客户端重启保留；未完成的输入仍只保存在一个浏览器配置中。

---

## 📊 指标

间接地，通过 `dsh-tool-ask-user`：它会将成功回答保留为紧凑 JSON，或返回以下失败之一：`Error: ask_user_question was aborted before the user answered`、`Error: ask_user_question requires at least one question`、`Error: human interaction requires the exact live calling agent when an agent is supplied`、`Error: human interaction is unavailable while the calling agent is owned by another live agent; include the unresolved question or decision in the child agent's final result`、`Error: no user-questions answerer accepted the request` 或 `Error: <message>`。等待人类回答不会增加 token。

#### KV Cache 影响

不会直接使 KV Cache 失效；请求前缀的任何变更均由上述消费方负责。

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

**npm**: @deepseek-ai/dsh-user-questions
