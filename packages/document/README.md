---
title: "document/ — Office 转换"
tags: ["deepseek-harness", "document", "document"]
category: "文档"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# document/ — Office 转换

💡 概述
### 摘要
在宿主上将已授权的 Office 文件转换为可复用的 PDF。共享服务使用 LibreOffice kit 执行转换。声明了原生引擎的目标使用原生引擎，其余目标使用 Node WASM。


---

⚡ 功能
「待补充」

---

📊 指标
「待补充」

---

🏛️ 设计
### 开发备注
<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>


---

📁 目录
### 包
每个包负责自身配置和生命周期规则；子系统参考描述共享转换操作。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [office-to-pdf](office-to-pdf/README.zh.md) | 将已授权 Office 字节转换为完整 PDF，并提供有界队列和缓存 | `ctx.officeToPdf` |


---

🔗 资源
消费者负责源文件授权与展示。

- [文档转换](../../docs/subsystems/office-to-pdf.zh.md) — 共享操作和生成的服务参考。
- [独立 kit 所有权](../../.agents/notes/implemented/architecture/2026-09-14-independent-libreoffice-kit.zh.md) — 引擎分发与应用集成。
- [工作区文件](../api/workspace-files/README.zh.md) — 已授权的有界源文件读取。


---

🚀 快速开始
「待补充」

---

⚙️ 技术栈
「待补充」
