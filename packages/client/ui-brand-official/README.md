---
title: "client-ui-brand-official"
tags: ["deepseek-harness", "client", "ui-brand-official"]
category: "客户端"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# client-ui-brand-official

💡 概述
本包让以 `official` profile 构建的客户端在侧栏显示 DeepSeek Harness 标志与名称。其他构建 profile 保留外壳的鱼形标志与本地构建标签，会话首屏则始终使用动画鱼。品牌为 DeepSeek Harness 的部署应选择本包；使用其他品牌的部署应提供替代品牌包。本包不保留运行时状态，也不影响模型请求。


---

⚡ 功能
在采用 DeepSeek 自有品牌的部署中，将本插件挂载到浏览器插件名单，然后以 `official` profile 构建客户端，让填充得以注册。


---

📊 指标
无，因为本包只贡献浏览器呈现；这里没有任何内容进入模型请求。

##### KV Cache 影响
无；本包既不组装也不发送提供方请求。


---

🏛️ 设计
#### 选择 profile
`DSH_CLIENT_BUILD_PROFILE` 决定渲染哪个品牌。`official` 构建在侧栏显示官方标志与名称；任何其他取值都让外壳回退——鱼形标志与本地构建标签——保持原样。会话首屏无论 profile 如何都显示来自 `dsh-client-ui-conversation` 的动画首屏鱼，因为这个回退本身就是官方标志。两种情况下插件都会照常加载并通过校验；只有注册受 profile 门控。

#### 替换品牌
自有身份的部署不组合本包，而是组合另一个占据侧栏 slot——以及本包留给回退的首屏 slot——的包。占据 slot 是唯一的组合路径；这里不存在任何品牌配置面。

<details>
<summary>实现细节——点击展开</summary>

两个填充作为一组声明感知的注册安装：嵌套的 `ctx.slots.inject()` 调用等待侧栏声明，因此无论本行在声明者之前还是之后激活，这组注册都能工作；声明消失时两个填充一并撤回，HMR 期间也不会留下残缺的品牌混合。浏览器半部是 [`src/client/index.ts`](src/client/index.ts)；node 半部是一个空 Loader 座位。浏览器标题是构建环境的事（`DSH_CLIENT_TITLE`），不在 slot 系统之内。

</details>

### 已知限制与延期工作
这些限制界定了品牌呈现的供给方式。它们是当前包约束，不是品牌设计对比或任务积压。

- **只有一组填充**——替代呈现属于占据相同 slot 的另一个 Cordis 包。
- **浏览器标题独立**——`DSH_CLIENT_TITLE` 在构建时选择标题文本，而非通过 UI slot。

#### 开发备注
<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>


---

📁 目录
「待补充」

---

🔗 资源
当品牌面不够用时阅读以下页面。它们从本包占据的 slot 进入渲染这些 slot 的外壳。

- [ui-sidebar](../ui-sidebar/README.zh.md)——声明 `sidebar.brand.mark` 与 `sidebar.brand.name` 并渲染其回退。
- [ui-conversation](../ui-conversation/README.zh.md)——在首屏声明 `conversation.hero.brand.mark`。
- [Web 客户端架构](../../../docs/subsystems/web-client.zh.md)——浏览器插件行如何加载并注册 slot。


---

🚀 快速开始
「待补充」

---

⚙️ 技术栈
「待补充」
