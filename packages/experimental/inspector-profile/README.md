---
title: "experimental-inspector-profile"
tags: ["deepseek-harness", "experimental", "inspector-profile"]
category: "实验性"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# experimental-inspector-profile

💡 概述
启用这个可选组合包，即可在 Sidebar 检查 Session 数据，并在底部面板打开 NodeJS 诊断。组合包启用两个 Inspector 和 Host fetch 采集；组合包自身在插件管理器中默认关闭。


---

⚡ 功能
在插件管理器的官方分组中启用**开发者工具**，即可为当前 Web profile 选择 `@deepseek-ai/dsh-experimental-inspector-profile`。

从 Sidebar 的新建 tab 菜单或引导页打开**会话数据诊断**。[Session Inspector](../session-inspector/README.zh.md) 提供一个视图，可选择原始数据或对话分组展示形式，初始选中原始数据。

按 **Ctrl/Cmd+Shift+.** 可展开或收起底部面板中的 **NodeJS 诊断**，使用打包后的 DevTools 前端。启用组合包会启动本地调试后端和未经脱敏的 Host fetch 采集，不需要用户配置覆盖或调试参数。


---

📊 指标
无，因为本组合包挂载开发者检查插件，不贡献模型上下文。

##### KV Cache 影响
无；本组合包不增加请求内容。


---

🏛️ 设计
<details>
<summary>实现内部细节 — 点击展开</summary>

[`cordis.patch.yml`](cordis.patch.yml) 启用会话数据诊断 和 NodeJS 诊断 后端，并设置 `captureFetch: true`，不依赖调试参数。调试与采集行为见 Inspector [README](../inspector/README.zh.md)。每个插件负责自身行为与生命周期。

</details>

### 已知限制与延期工作
- **仅支持 Web** — 检查视图依赖 Web 应用的 Session 服务。
- **内部诊断** — 组件开关保持可用，但没有专用 Web 调试按钮。显式启用后会进行未脱敏采集并允许执行本地代码，请参阅[安全限制](../inspector/README.zh.md#security)。

#### 开发备注
<details>
<summary>维护者工作上下文 — 点击展开</summary>

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
