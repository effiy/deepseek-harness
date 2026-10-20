---
title: "experimental-badge-skill-bundle"
tags: ["deepseek-harness", "experimental", "badge-skill-bundle"]
category: "实验性"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# experimental-badge-skill-bundle

💡 概述
向预设支持技能加载的智能体提供实验性 DSH 徽章技能。共享提供者不添加模型工具。 Web 和 Desktop 随附此功能，默认关闭。在插件页选择它即可启用。


---

⚡ 功能
「待补充」

---

📊 指标
间接影响，通过[能力实现](../skill-badge/README.zh.md) 贡献模型上下文和结果。

##### KV Cache 影响
此配置层不直接添加请求内容；能力实现负责工具目录、提示和结果的缓存影响。


---

🏛️ 设计
<details>
<summary>实现细节 — 点击展开</summary>

[`cordis.patch.yml`](cordis.patch.yml) 在 Host 上添加 `skill-badge` 提供者行。后续根级补丁可以禁用该行；单独的覆盖不会选中组合包。[配置组合器](../../boot/app-boot/README.zh.md) 负责补丁顺序和错误处理。

</details>

### 已知限制与暂缓工作
- 预设必须支持技能发现和加载才能使用徽章。此 bundle 不会为 minimal 预设添加技能工具。

#### 开发备注
<details>
<summary>维护者上下文 — 点击展开</summary>

无。

</details>


---

📁 目录
### 使用此包
在 Web 或 Desktop 中打开插件页，在官方分组启用 **DSH 徽章技能**。关闭后移除其配置层。

开关为已有和新建智能体添加或移除 Host 级技能提供方。提供技能加载能力的预设可以使用徽章；minimal 的工具目录保持不变。


---

🔗 资源
[能力实现](../skill-badge/README.zh.md)


---

🚀 快速开始
「待补充」

---

⚙️ 技术栈
「待补充」
