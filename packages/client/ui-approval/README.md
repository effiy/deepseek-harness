---
title: "client-ui-approval"
tags: ["deepseek-harness", "client", "ui-approval"]
category: "客户端"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# client-ui-approval

💡 概述
基于 Agent-scoped Remote Event waterfall 的浏览器审批界面。插件通过 `ctx.uiSession` 发布每个待处理请求、接管 Conversation composer、按需渲染关联的 Tool 详情，并将用户决定返回给等待中的 Host 请求。当浏览器必须为等待中的 Host 操作收集批准时，请使用它。


---

⚡ 功能
「待补充」

---

📊 指标
无，因为本包只在浏览器中呈现审批请求，不注册任何面向模型的内容。

##### KV Cache 影响
无；审批请求和响应的呈现不会改变模型请求。


---

🏛️ 设计
### 已知限制与暂缓事项
- **面板只提供临时决定**——它支持仅本次允许和拒绝；持久权限策略仍由 Host 侧审批包拥有。请求方提供的本地化展示文案跟随界面语言，不改写审计原因，也不翻译模型生成的文本。

#### 开发备注
<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>


---

📁 目录
「待补充」

---

🔗 资源
「待补充」

---

🚀 快速开始
「待补充」

---

⚙️ 技术栈
「待补充」
