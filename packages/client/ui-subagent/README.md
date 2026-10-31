---
title: "client-ui-subagent"
tags: ["deepseek-harness", "client", "ui-subagent"]
category: "客户端"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# client-ui-subagent

💡 概述
从父会话页头浏览本地子代理对话与外部任务。本地对话展示活跃状态、token 用量和耗时；可继续子代理接受后续提示词并支持 Stop。外部任务显示为不可打开的叶子项，不展示执行状态。历史一次性对话以只读记录打开。普通侧边栏省略子代理对话；独立的 `@` 来源插入运行中子代理的标签，不授予继续执行权限。


---

⚡ 功能
会话页头把当前会话标题作为谱系面包屑；当会话的直接目录有子项或读取失败时，后代数量触发器渲染在页头操作区的最前方，不带任何面包屑分隔符。目录缺席、空目录加载中或成功加载为空时，均隐藏数量触发器。触发器打开该直接目录，报告总数与运行数，并且只在行展开时加载嵌套目录。选择任意深度，即可用该子会话的确切 `{parentSessionId, childSessionId, mode}` 地址打开其对话；也可以使用行尾箭头在右侧 Sidebar 打开同一地址，并在空间允许时优先使用独立分栏。

本包注册 `dsh-resource://subagentchat/session/<child>?parent=<parent>&mode=<mode>` 资源与 builtin Sidebar tab 类型。资源直接根据地址保留 child 的 `SessionReference`，不刷新 parent 目录，并在 tab 记录关闭时释放 reference。tab 通过 `sidebar.chat.conversation` 渲染共享 `conversation.content` Factory，把局部 View 固定为 Chat，并省略主 Conversation 的 Header 与宽度控制。


---

📊 指标
##### Token 影响
有条件且仅追加：字面 `@label` 或用户后续消息只会向对应的新用户消息增加 token。目录与 transcript 操作增加零模型 token。

##### KV Cache 影响
仅追加。本包绝不改写更早的请求 token。


---

🏛️ 设计
#### 续接对话
确切 parent 存活时，可继续 child 保留普通输入 chrome：child 运行期间输入和 Send 保持可用，因为每条后续消息都会进入 child 的 FIFO inbox，而独立的 Stop 经由 `subagents/interruptByParent` 路由。确切 parent 不可用且 child 未在运行的可继续 child 会选用说明恢复路径的只读编辑器；此类 child 仍在运行期间，selector 会让位给普通编辑器——输入区与 Send 被禁用，但独立的 Stop 保持可用。

#### `@` 引用 source
`@` source 仍然刻意保持独立且惰性：候选是从 `ctx.sessions.list` 零 RPC 得到的运行中 child；pick 会插入字面文本 `@label `，codec 投影为 `@label`。它不参与命令裁决，也不会把 label 解析成继续执行地址。

<details>
<summary>实现细节——点击展开</summary>

[子代理运行时](../../subagent/subagent/README.zh.md)负责 continuation 与中断；[对话参考](../ui-conversation/README.zh.md)说明编辑器行为。

#### 耗时、完成状态与 token
每个可见目录层在包含运行中 child 时独立推进时钟；折叠该层或关闭菜单会释放时钟。token 用量总计为四个互不重叠的 `tokenUsage` 桶之和。`subagentTiming` 投影会累加已结束轮次的耗时，并记录最近一个已结束轮次是否以 `completed` 结束；新轮次开始时会清除该完成状态，直到自身的 `turn/end` 到达。耗时仅在运行中 child 存在未结束轮次时每秒递增一次，并在 child 变为 inactive 后冻结；被中断的未结束轮次以其同一切面的 `active.through` 为上界，绝不使用更新的会话元数据。

#### 编辑器选举
one-shot child 始终选用只读编辑器。可继续 child 仅在其确切 parent 不可用且 child 未在运行时选用只读编辑器；否则普通编辑器的会话会经 `subagents/prompt` 路由提示词。本包绝不接收宿主上下文，也不调用面向模型的工具。

模式未知的目录项仍可见、可点击，没有标签时显示子会话 id。读取子历史并确认受支持模式前，输入区保持只读；读取失败在该子会话中报告。

</details>

#### 用户提示词中的 subagent label 文本
##### 模型看到的内容
只有 `@` 引用 source 会影响模型输入：pick 的候选以字面文本 `@label` 进入普通用户消息，没有专用内容块或宿主侧解析。浏览目录、导航 child 与查看持久化 transcript（文本记录）都不会添加提示词 section；已接收的继续交互内容会经宿主 subagent 适配器成为普通 FIFO 用户消息。

### 已知限制与延期工作
这些限制定义目录能显示什么、`@` 引用意味着什么；它们是当前包约束。

- **非完成的 inactive 结果仍合并显示**：目录能区分最近一次正常完成与其他 inactive 状态，但不区分失败、取消、拒绝、token 耗尽或尚无已结束轮次的 child；UI 不公开 Activation 身份，停止能力仅限编辑器上针对运行中可继续 child 的当前轮次 Stop。
- **`@` 引用仍是显示标题文本**：重复或改名后的 label 会有歧义，因此它们刻意不获得继续执行语义。

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
以下页面覆盖对话界面、宿主 seam 与设计笔记。

- [ui-conversation](../ui-conversation/README.zh.md)——承载页头操作与编辑器链的聊天界面。
- [ui-input-trigger](../ui-input-trigger/README.zh.md)——承载 `@` source 的建议机制。
- [subagent](../../subagent/subagent/README.zh.md)——可继续 child 背后的宿主能力 seam。
- [历史Web subagent 对话](../../../.agents/notes/archived/feature/2026-07-27-web-subagent-conversations.md)——目录与编辑器规范。
- [当前轮次中断](../../subagent/subagent/README.zh.md)——独立 Stop 的语义。


---

🚀 快速开始
「待补充」

---

⚙️ 技术栈
「待补充」
