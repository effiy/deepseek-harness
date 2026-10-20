---
title: "client-store"
tags: ["deepseek-harness", "client", "store"]
category: "客户端"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# client-store

💡 概述
供 Client 控制器与 renderer 适配器共用的不依赖 React 的 observable 和快照存储基础原语。本包负责同步与 animation-frame 发布、基于 Immer 的更新、浅比较和可选的浏览器持久化；React 钩子的构造仍属于 `@deepseek-ai/dsh-client-ui-renderer`。当 Client 状态必须在不依赖 React 的情况下发布稳定快照时，请使用它。


---

⚡ 功能
「待补充」

---

📊 指标
无，因为本包提供浏览器侧状态基础原语，不注册任何面向模型的内容。

##### KV Cache 影响
无；这些存储既不组装也不发送模型请求。


---

🏛️ 设计
### 已知限制与暂缓事项
- **持久化仅限浏览器本地**——持久化存储使用 `localStorage` 中的 JSON；非浏览器运行时会禁用持久化，本包也不提供跨设备同步。
- **Web 壳构建输入**——静态 ESM 为 Vite 保留第三方导入；独立消费方自行提供开发依赖（[依赖规则](../AGENTS.md#dependency-declaration)）。

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
