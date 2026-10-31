---
title: "experimental-session-search"
tags: ["deepseek-harness", "experimental", "session-search"]
category: "实验性"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# experimental-session-search

💡 概述
为所有智能体提供五个实验性只读全局工具，用于搜索历史会话。内容索引在首次搜索时打开，由所有智能体共享。Web 和 Desktop 随附此配置包，默认关闭。在插件页选择它即可启用。


---

⚡ 功能
「待补充」

---

📊 指标
间接影响，通过[能力实现](../tool-session-query/README.zh.md) 贡献模型上下文和结果。

##### KV Cache 影响
此配置层不直接添加请求内容；能力实现负责工具目录、提示和结果的缓存影响。切换组合包会改变运行中会话的工具列表，使其已缓存的请求前缀失效一次。


---

🏛️ 设计
<details>
<summary>实现细节 — 点击展开</summary>

[`cordis.patch.yml`](cordis.patch.yml) 插入 Host 组 `optional-session-search`，在全局工具层注册这些工具。后续配置补丁可以按 id 覆盖其条目。[配置组合器](../../boot/app-boot/README.zh.md) 负责补丁顺序和错误处理。

该组拥有独立的 `sessionQuery` 提供方和惰性打开的 `:memory:` 索引，关闭组合包时释放。Host 的元数据服务仍使用 `openAt: never`。

</details>

### 已知限制与暂缓工作
- 组合包在首次搜索后持有一个内存索引。应用重启或重新开关组合包后索引会重建。搜索仍仅限获授权的工作区。

#### 开发备注
<details>
<summary>维护者上下文 — 点击展开</summary>

无。

</details>


---

📁 目录
### 使用此包
在 Web 或 Desktop 中打开插件页，在官方分组启用 **会话搜索**。关闭后移除其配置层。

启用或关闭组合包会在运行中的 Host 注册或移除其全局工具，因此所有预设（包括 minimal）中的每个智能体都会在下一次请求时看到变化。

此配置包启用智能体的搜索工具。侧边栏搜索保留现有行为。


---

🔗 资源
[能力实现](../tool-session-query/README.zh.md)


---

🚀 快速开始
「待补充」

---

⚙️ 技术栈
「待补充」
