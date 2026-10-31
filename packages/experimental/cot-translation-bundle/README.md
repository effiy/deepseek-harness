---
title: "experimental-cot-translation-bundle"
tags: ["deepseek-harness", "experimental", "cot-translation-bundle"]
category: "实验性"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# experimental-cot-translation-bundle

💡 概述
将展开的思考内容翻译为界面语言或其他指定语言。在 Web 或 Desktop 的插件页面启用思考过程翻译；发布的 profile 默认禁用该功能。默认翻译服务为 Bing，也可在 Bundle 设置中选择 Google。原始思考内容始终可访问，Session 与模型输入中的原文保持不变。


---

⚡ 功能
打开插件页面，在官方分组中启用思考过程翻译。打开详情，选择翻译服务及目标语言。`auto` 跟随界面语言；填写 `zh`、`en` 或 `ja` 等语言代码则使用指定语言。保存后应用设置。

展开思考行以开始翻译。内容区翻译完整段落和流式长段落中达到请求长度的前缀，并保留未完成的末尾片段。翻译工具栏内的“查看原文”将展开的正文切回源文本，“查看译文”切回译文。翻译失败时保留原文，并提供重试。禁用 Bundle 会移除控件并取消待处理请求。成功译文仍保存在 Session 中，相同请求在重新展开、页面重新加载或 Host 重启后会复用已有结果。

所选服务会接收展开的思考内容，其中可能包含私有代码与对话细节。Google 和 Bing 通过 POST 请求体接收原文。Bing 和 Google 无需额外登录或 API key，但两种免登录端点均不保证可用性或免费额度。符合条件的原生 `deepseek-flash` 路由显示为显式的付费选项，使用已配置的 DeepSeek 账号或官方 API 凭据。每个未缓存片段执行一次关闭思考的独立查询。重新展开复用已保存结果；改变 Provider、语言、原文或翻译规则时可能需要再次付费查询。匹配模型 ID 时不限制版本号，且排除 pi-ai 路由。Provider 失败后不会自动将文本发送给其他服务。


---

📊 指标
间接影响来自可选的独立付费 Flash 请求，以及缓存未命中时的正常 Session 激活；translator 负责翻译提示词，Session 的 preset 负责启动上下文。

##### KV Cache 效果
翻译记录保留原始思考内容；正常 Session 激活及可选付费查询的缓存影响见 [GUI 消费者](../client-ui-cot-translation/README.zh.md#model-experience)。


---

🏛️ 设计
### 了解实现
<details>
<summary>维护者细节 — 点击展开</summary>

Bundle 补丁插入 `translator` 和 `cot-translation`，选择 Bing 与界面语言。Translator 负责 Provider 协议、网络限制及统一持久保存的请求与结果；GUI 消费者负责设置、段落调度和当前展示使用的本地缓存。GUI 直接复用已保存结果，新翻译需要现有写入器时等待正常 Session 激活。生成的 Remote contribution 仅在 Bundle 启用期间挂载。翻译包装与 Chat 默认 Body 条目均调用官方思考 Content Factory。

</details>

### 延伸阅读
[文本翻译子系统](../../../docs/subsystems/translation.zh.md) · [Translator 服务](../translator/README.zh.md) · [GUI 消费者](../client-ui-cot-translation/README.zh.md)

### 已知限制与后续工作
- 折叠摘要保留原始语言。读者展开思考内容后才开始翻译；译文可能改变 Markdown 或代码格式。原文始终可访问。
- 免登录 Google 和 Bing 浏览器端点可能失败、限制请求或更改响应格式。中国大陆连通性取决于部署的网络与代理配置。成功译文在折叠、移除 Bundle 或重启后仍保留在 Session 中。实验性记录在未来 Session 格式迁移中仅提供尽力保留。

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
