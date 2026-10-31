---
title: "client-ui-session"
tags: ["deepseek-harness", "client", "ui-session"]
category: "客户端"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# client-ui-session

💡 概述
使用本包可通过标准 Slot 钩子公开 Session catalog、retain 信息与统一 UI 状态。它按 `SessionBinding` 物化钩子和 prop，而 `SessionProvider` 可以继承外围 binding 或绑定显式 `SessionReference`。它拥有进程本地的 pending-interaction 与完成提醒策略，但不拥有 Controller transport、历史或 reference。

运行状态来自 Host 列表基线或状态事件。Subagent 目录行和已保留子会话的 fallback 行不会建立运行状态；主视图引用仍会确认完成提醒。


---

⚡ 功能
「待补充」

---

📊 指标
无，因为本包适配浏览器侧 Session 状态，不注册任何面向模型的内容。

##### KV Cache 影响
无；Session selector 与 Slot scope 不会组装模型请求。


---

🏛️ 设计
### 已知限制与暂缓事项
- **Pending interaction 是进程本地投影**——浏览器重连后，所属 Remote waterfall（瀑布式事件）必须重放仍未完成的请求。

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
