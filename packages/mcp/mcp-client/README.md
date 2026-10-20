---
title: "@deepseek-ai/dsh-mcp-client"
tags: []
category: "mcp"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-mcp-client` 让模型使用外部 MCP（Model Context Protocol）服务器的工具与资源。每台服务器配置一条记录；其工具使用 `mcp__github__create_issue` 这样的名称。默认不启用任何服务器。随附 profile 已提供[共享资源发现与读取](../mcp-resources/README.zh.md)。调用方作用域为空时，不添加 MCP 工具或提示词文本。服务器指令作为字面文本加入已记录的系统提示词；MCP 提示词模板不受支持。缓慢或崩溃的服务器可能延迟启动，或让调用失败直至恢复。

---

## ⚡ 功能

### 限制

这些限制说明你无法用本插件做什么、以及何时需要运维注意。它们是当前包约束，不是与其他 MCP 客户端的对比，也不是任务积压。

- **资源按需读取**——随附 profile 提供[共享资源服务](../mcp-resources/README.zh.md)；资源订阅与 MCP 提示词模板不受支持。
- **启动与发现超时继承自 MCP SDK**——插件不暴露单独的连接或发现超时。协商与发现使用 SDK 默认的 60 秒请求超时；发现也使用 SDK 的页数上限。插件卸载先关闭传输以中断待处理的启动请求，再等待清理。
- **重连处理协商失败与传输关闭**——初始探测失败或 stdio 子进程崩溃都会使用配置的重连预算。HTTP 建立连接后，请求失败使用 SDK 传输的恢复机制，而非重新创建连接。
- **图片是唯一的持久丰富结果桥接**——PNG、JPEG、WebP 与 GIF 在确切能力得到证明后进入 Native 上下文。音频与嵌入资源载荷仍只存在于执行局部并带明确诊断，资源链接只以文本保留名称与 URI。
- **无效的协议结果或输出 schema 由 SDK 拒绝**——桥接器不接受旧式 `toolResult` 替代结果，也不绕过已声明的 schema 校验。
- **要求基于任务的 MCP 工具在调用时被拒绝**——要求使用基于任务的执行（task-based execution）扩展的工具会抛出异常而非被桥接；该扩展未实现。

---

## 📊 指标

### 已发现的 MCP 工具

#### 模型看到什么

发现成功后，SDK 接受的 MCP 工具以原生工具名称 `mcp__<serverName>__<rawName>`（或其确定性规范化形式）出现，携带服务器描述和输入 schema。重新同步会替换注册代；释放或重连预算耗尽会移除工具。未声明 tools 能力的服务器以空工具集连接。

#### Token 影响

工具注册期间，工具描述与输入 schema 会进入每次请求；重新同步会替换而非累积 schema，服务器限定名称也会为每个工具定义和调用增加 token。已配置客户端还会启用[共享资源工具与服务器名称提示词](../mcp-resources/README.zh.md#model-experience)。

#### KV Cache 影响

已发现工具集合及其 schema 不变时，工具定义前缀保持稳定。增加、移除、重命名或更改工具的重新同步会替换定义，并可能使从第一个变化的 schema token 起的复用失效；恢复未变列表的重连会生成完全相同的定义，前缀保持稳定。

### 工具调用历史与结果

#### 模型看到什么

公开工具名称和 JSON 参数保留在 assistant 历史中。规范值始终为程序化调用方与 PTC 模式调用方保留完整的 MCP JSON 块与可选结构化内容；受支持的图片块在确切路由能力得到证明后，按原始顺序与文本一起投影。被拒绝的图片、音频、嵌入资源、资源链接与未知块继续以有界文本诊断可见；MCP `isError` 会在图片持久化之前拒绝调用。

#### Token 影响

参数、映射后的文本与持久图片引用保留到压缩（compaction）发生时。内联 MCP base64 只存在于执行局部的规范值中，绝不会复制进会话事件；提供方会从附件存储读取经过校验的字节。音频与嵌入资源载荷不会进入模型上下文。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV-cache 条目失效。

### 服务器指令

#### 模型看到什么

每个成功连接返回的非空白指令保存在一个带服务器名称的段落中。未返回指令或指令仅含空白时，不向提示词添加文本。花括号保持字面值。替代连接仅在发现成功后发布其指令；释放或耗尽恢复预算时移除该段落。

#### Token 影响

作用域段落生效期间，服务器指令为模型请求贡献文本。资源文档仅通过显式资源读取进入历史。

#### KV Cache 影响

未变化的指令保留相同提示词文本。更新或移除指令会改变下一次组装的系统消息及其可复用前缀。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释桥接背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

- **服务器限定身份。** 每个 MCP 工具都有稳定的身份 `(serverName, rawName)`。namespace 是本地配置，绝不采用远程 `serverInfo.name`——远程名称不可信、在部署间不唯一、且升级时可能变化，这些都不允许静默重命名面向模型的工具。
- **命名是固定约定。** 公开名称是 `(serverName, rawName)` 的纯函数，并满足 DeepSeek 函数名称约定；有损规范化会追加 12 位十六进制 SHA-256 hash，使不同身份绝不会折叠。会话历史与权限规则因此能在 HMR（热模块替换）、重新同步和其他服务器变化后保持有效。
- **原始名称是唯一的协议名称。** `tools/call` 始终收到原始名称；公开名称绝不会发给服务器，也绝不会被解析来还原原始名称。
- **要么完整世代，要么没有。** 同步会原子地交换世代：获取失败保留上一世代，注册冲突则回滚整个尝试中的世代。
- **一个规范值，一个投影。** 执行器保留完整的规范 MCP 返回值，并准备有序图文内容。`projectContent` 在 `tools/post-execute` 之前安装已准备的内容，让省略策略看到真实图片块。后续策略的内容替换、值替换和阻止均保持生效。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config` schema、`serverName` 预留、激活等待 |
| [`src/connection.ts`](src/connection.ts) | 连接监督器：客户端世代、重连策略、尝试预算、dispose（资源释放） |
| [`src/server-context.ts`](src/server-context.ts) | 资源提供方注册与字面服务器指令 |
| [`src/tools.ts`](src/tools.ts) | 工具桥接：发现、命名、注册交换、执行、图片投影 |
| [`src/transport.ts`](src/transport.ts) | 传输工厂：带清洗环境的 stdio spawn、Streamable HTTP |

导出的 `createMcpToolDefinition(ctx, options)` 将上游工具 schema 和原始结果回调适配到相同的规范值、错误和持久化图像投影。每次回调都收到原样的 `ToolExecution`，包括其 Agent 和取消信号；SDK 的规范类型校验会在投影前检查返回结果。调用方负责注册、取消截止时间和提供方卸载。原生 Cua Driver 提供方使用此适配函数，无需打开 MCP 传输。

### 生命周期与同步

`apply` 解析重连策略、在当前注册作用域内预留 `serverName`、启动监督器，并等待初始连接加发现完成。独立 agent（智能体）作用域可以复用相同 namespace，因为其工具与传输彼此隔离；同一作用域内重复会在加载时失败。监督器把所有同步——初始、通知与重连——串行到同一条队列，因此两次同步绝不会交错执行各自的先 dispose 后注册交换。dispose 会取消待执行的重连、关闭协商中的传输或已绑定的客户端、等待进行中的尝试与排队同步完全停稳，然后注销当前世代。

SDK 通过旧版通知或现代协议订阅接收工具列表变化。监督器将每次重新同步排队；获取失败时保留之前的注册代，注册冲突则回滚本次尝试。每次故障共享一个尝试预算：连续失败达到 `maxAttempts` 后注销工具并停止重连；连接持续超过 `maxDelayMs` 则重置预算。

### 工具执行内部细节

工具调用向 SDK 提供原始名称、完整工具定义、JSON 参数、取消信号及配置的超时。SDK 负责协议校验、已声明输出 schema 的校验和现代协议请求 header。成功结果规范值为 `{ content: JsonValue[], structuredContent? }`，为编程调用方及 PTC 模式保留有效的 MCP JSON 块。MCP `isError` 结果会在图片持久化前抛出。桥接器在保存前校验整批图片；拒绝时将每张图片投影为诊断文本。

### 环境清洗（stdio）

子进程环境以子进程 seam 的 `scrubbedParentEnv()` 为基座——删除匹配 `/KEY|PASSWORD|SECRET|TOKEN/i` 的环境名称与所有 `DSH_*` 名称——再在其上合并配置的 `env`，因此显式覆盖得以保留。实际 spawn 由 MCP SDK 负责；本包共享清洗定义，而非 spawn 路径。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放设计问题与尚未决定的探索方向。它明确不具权威性——已交付行为、限制与既定理由以上文、包代码与所链接的 Agent Note 为准。

- 公开名称算法是由测试固定的 v1 约定；发布后更改会破坏会话历史与权限规则。
- 由 DSH 显式拥有的连接与发现超时是开放的探索方向；SDK 的 60 秒默认值约束着启动请求。
- Streamable HTTP 的重连归属仍未决定：按请求重试是 SDK 行为，supervisor 也可以拥有 HTTP 世代。
- MCP 提示词模板需要独立的用户选择和模板调用机制。
- 固定的 MCP SDK 仍在演化；上游破坏性变更需要更新桥接。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config` schema、`serverName` 预留、激活等待 |
| [`src/connection.ts`](src/connection.ts) | 连接监督器：客户端世代、重连策略、尝试预算、dispose（资源释放） |
| [`src/server-context.ts`](src/server-context.ts) | 资源提供方注册与字面服务器指令 |
| [`src/tools.ts`](src/tools.ts) | 工具桥接：发现、命名、注册交换、执行、图片投影 |
| [`src/transport.ts`](src/transport.ts) | 传输工厂：带清洗环境的 stdio spawn、Streamable HTTP |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从共享工具注册表逐步进入桥接的设计证据与可运行的示例配置。

- [工具子系统参考](../../../docs/subsystems/tools.zh.md)——接收已桥接工具的 `ToolRuntime` 与 `ctx.tools.register()` 约定。
- [历史MCP 客户端插件 Agent Note](../../../.agents/notes/archived/feature/2026-07-07-mcp-client-plugin.md)——命名不变式、发现与执行设计、备选方案与后果。
- [规范工具输出约定 reference](../../core/tools/README.zh.md)——MCP 结果如何映射进规范工具输出约定。
- [第三方记忆 MCP 指南](../../../docs/user/guide/mcp-memory.zh.md)——使用本包的三份记忆服务器 overlay。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-mcp-client)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- id: mcp-github
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: github
    transport: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-github']
    env:
      GITHUB_TOKEN: !!js process.env.GITHUB_TOKEN

- id: mcp-web
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: web
    transport: streamable-http
    url: http://localhost:3000/mcp
    headers:
      Authorization: !!js '`Bearer ${process.env.MCP_TOKEN}`'
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `transport` | 必填 | `stdio` 或 `streamable-http` |
| `serverName` | 必填 | 服务器工具名称的 namespace；`[A-Za-z0-9_-]{1,32}`，在一个注册作用域内唯一 |
| `command` / `args` / `env` / `cwd` | — | stdio：可执行文件、参数、合并到清洗过的环境之上的额外环境变量、工作目录 |
| `url` / `headers` | — | streamable-http：端点 URL 与额外请求标头 |
| `toolCallTimeoutMs` | `60,000` | 每次 `tools/call` 或资源请求的超时 |
| `maxInstructionBytes` | `32,768` | 包括服务器归属信息在内的服务器指令 UTF-8 字节上限；超出时连接失败 |
| `failOnStartupError` | `false` | 初始连接或工具同步失败时拒绝插件激活 |
| `reconnect.enabled` | `true` | 连接丢失后自动重新连接 |
| `reconnect.initialDelayMs` | `500` | 首次重连延迟；每次连续失败尝试翻倍 |
| `reconnect.maxDelayMs` | `30,000` | 退避上限；同时是重置尝试预算所需的正常运行时长 |
| `reconnect.maxAttempts` | `10` | 每次中断内连续失败尝试次数上限，超出后放弃 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-mcp-client
