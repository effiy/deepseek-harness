---
title: "@deepseek-ai/dsh-llm-pi-ai"
tags: []
category: "llm"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`@deepseek-ai/dsh-llm-pi-ai` 通过一份配置把模型请求路由到多个 pi-ai 提供方、OpenAI 兼容网关或自托管服务器。已安装的 pi-ai 提供方会提供端点、协议和模型目录默认值；自定义路由可以直接声明这些值，无需修改代码。profile 与凭据按请求解析，因此设置变更会在下一个请求生效，无需重启。受支持的提供方可以使用已存储的 OAuth 或交互式密钥登录，并通过跨进程锁刷新凭据。本包可以在没有路由时启动，并在用户设置添加路由后将其激活。

---

## ⚡ 功能

### 适用场景

当同一组合服务多个提供方、某条路由需要 pi-ai 目录默认值并修正少数字段、或必须通过自有端点与协议到达手工声明网关时，选择本适配器。当部署不需要其他提供方时，选择 `dsh-llm-deepseek` 直连 DeepSeek 路由。两个适配器可以同时挂载，因为它们的路由名不冲突；注册其他适配器已拥有的路由会导致插件加载失败。

### 限制

这些限制说明适配器在哪里停止、由未来工作接续。它们是当前包约束，不是通用 pi-ai 对比或任务积压。

- **`maxRequestImageBytes` 只计算 base64 图片载荷**，文本、工具、描述符与 JSON 结构在该上限之外，因此它必须留有余量地低于网关请求体上限。
- **登录只存在于发起它的进程中**——授权尝试不持久，因此登录中途刷新页面会放弃它，用户需要重新开始。退出登录是对已存储记录执行 `deleteRecord`，只在本地忘记它，不会告知签发方。
- **OpenAI 不提供 ChatGPT 登录**——pi-ai 的 Sign in with ChatGPT 用应用提供的稳定 UUID 向 OpenAI 标识安装实例，而 harness 没有用于第三方账号登录的安装 ID；`openai` 路由改用 API key 登录。
- **提供方原生发现经本插件的 ambient context 回答**——不点名凭据的路由交由目录提供方自身解析，它会询问环境值（`AZURE_OPENAI_API_KEY`、`AWS_PROFILE` 及各提供方自有集合）与本地凭据文件。两个问题都在这里得到回答：凭据 seam 先于进程环境被查询，文件存在性则针对宿主进程的文件系统以 `~` 展开后检查。它做不到的是*读取*凭据文件内容——自行解析 `~/.aws/credentials` 的提供方会直接读取，不经该 seam。
- **重置恢复继承配置**——重置下层 profile 提供的路由会恢复该路由。
- **完整替换 Config 可以移除继承的字典条目**——字段重置则恢复其继承值。
- **`headers` 可以携带 redactor 永远看不到的凭据**——profile 解析会拒绝 Fetch 无法表示的名称与值，但该字典仍是纯字符串；以 `apiKeyEnv` 引用存储凭据。
- **发现操作不更改已配置模型**——需显式将发现结果采纳到路由配置中。
- **Anthropic 模型发现最多读取 1,000 个模型**——请求使用 API 的最大页大小，但不会遍历 `has_more`；第一页之外的条目需要手工添加。
- **每条路由一种协议格式**——混合协议目录路由无法承载另一协议格式的模型；把提供方拆到两个路由键是变通办法。
- **模态声明不受校验**——声明 `image` 而其网关不支持的模型会在提示词准入后被提供方拒绝。持久图片仍留在历史中，同一误声明模型可能再次失败；切换到纯文本模型仍然可行，因为共享 LLM 运行时会针对该请求把图片引用投影为稳定文本。
- **未认证路由取决于其协议**——不点名凭据的路由解析为已配置但无密钥，但 pi-ai 的 OpenAI 兼容实现仍要求 API 密钥或 `Authorization` 标头，因此无密钥本地服务器需要由 `apiKeyEnv` 引用或 `headers` 中的 `Authorization` 条目提供的占位凭据。
- **不支持 `GenerateOptions.stop`**——pi-ai 的通用流式选项无法跨提供方保证停止序列行为。
- **对话更新支持只来自已安装的 pi-ai 目录**——只有当路由的目录模型声明了对话中 compat 标志时，该路由才会在历史中接收提示词与工具更新，且 profile 不能设置这些标志；手工声明的路由与未标记的模型会在每次请求开头接收拼接后的系统消息与完整的当前工具列表。
- **图片只在 user 与工具结果消息中被接受**——system、developer 或 assistant 历史中的图片在两条转换路径上都会以 `UNSUPPORTED_CONTENT` 失败。
- **提供方 HTTP 状态不可用**——pi-ai 错误事件不跨提供方暴露稳定 HTTP 状态。
- **重试策略由提供方自有，而非 SDK 重试**——pi-ai SDK 重试保持禁用，因此持久 agent（智能体）步骤与 `llm/retry` 事件拥有每个可见尝试，直接 `ctx.llm.stream()` 调用仍是单次尝试。
- **流式工具调用参数只在调用结束时解析一次**——安装的 pi-ai 带有 [`patches/@earendil-works__pi-ai@1.0.2.patch`](../../../patches/@earendil-works__pi-ai@1.0.2.patch)，它移除了每个流适配器中对整段累计参数 JSON 的逐 delta 重新解析（上游 [earendil-works/pi#9265](https://github.com/earendil-works/pi/issues/9265)）；未打补丁时，数 MB 的参数流会在事件循环上消耗 O(n²) CPU，并使进程内所有会话停滞。在 `toolcall_end` 之前，pi-ai partial 的工具调用 `arguments` 保持为 `{}`；本适配器只读取 delta 字符串与最终参数。每次升级 pi-ai 时都要重新应用或撤销该补丁。

---

## 📊 指标

### 经 pi-ai 的提供方请求

#### 模型看到什么

所选目录模型会收到系统消息文本、对话历史、工具以及支持的采样字段。适配器按历史顺序保留后续系统消息；pi-ai 负责各协议的消息位置，并为不支持对话中系统消息的模型将它们拼接到开头。单次调用的 `GenerateOptions.system` 放在初始历史提示词之前。重复的系统消息仍会重复发送；空系统消息会被跳过，不会丢弃之前的文本。工具更新能力选择共享的历史声明投影；pi-ai 接收初始可用工具，以及按开发者消息分组的新增和受支持的移除更新。当包含工具更新的 Anthropic 请求中所有投影后的声明均为延迟加载时，初始可用工具为一个占位工具 `DeferredToolPlaceholder`，其描述要求模型永不调用它；若被调用，会得到普通的未知工具结果。Anthropic 在更新消息中以内联方式接收后续工具定义。回放会保留工具调用命名空间，以支持动态加载的 Responses 工具。每张保留图片前都会有文本，注明其完整附件 id 与实际请求尺寸。当前执行文件系统可以映射附件提供方的宿主对象时，该文本还会携带只读规范化对象路径，并警告规范化或请求投影可能缩放或重新编码上传内容。日志中的图片省略决策选中的每个出现位置都会在替换文本中保留自己的身份与当前已解析访问方式，其规范化附件不会读取或变换。当保留的出现位置按精确 base64 载荷仍超过路由的 `maxRequestImageBytes` 时，调用以 `IMAGE_OFFLOAD_REQUIRED` 失败，由 `dsh-compaction-image-offload` 用 `image/offload` 事件记录所选位置并重试步骤。提供方原生回放元数据只在适配器针对历史内容校验通过后恢复。

#### Token 影响

提供方分词决定精确输入。保留图片会添加稳定的附件与坐标描述符；卸载占位符会替代省略图片的视觉 token。回放元数据可能让原生 API 复用提供方侧状态。

#### KV Cache 影响

转换保持逻辑请求顺序，图片句柄与卸载占位符则会添加模型可见文本。即使附件身份与请求字节保持稳定，执行世界路径变化也会改写历史句柄，并可能从该图片起阻止复用。更换适配器实例、提供方、模型或其他上游 token 具有相同的后缀影响。一次省略决策会把较早图片换成占位文本，因此复用在该消息处结束；省略永不回退，此后前缀保持稳定。

### 提供方响应

#### 模型看到什么

pi-ai 事件变成 harness 的推理、文本、工具调用、用量与 finish 分片。适配器把解析后的工具参数以原始 JSON 字符串传给 harness。

#### Token 影响

生成内容只在 loop 记录后才影响后续输入。提供方未单独报告推理 token 时，pi-ai 会把推理 token 并入输出用量，并原样保留其精确 `totalTokens` 值。

#### KV Cache 影响

已记录的响应内容会追加到下一个请求，不会使其更早可复用前缀失效。未记录的传输元数据与用量计量不影响缓存标识。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释适配器背后的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

适配器建立在不可变快照与按操作解析之上。每个操作都会在第一次 `await` 前捕获整个快照——profile 加一个持有每条路由所构建 `Provider` 的 `createModels()` 集合——配置变更会构建新集合而非修改使用中的集合，因此在一个配置下开始的请求绝不会在另一个配置下结束。路由自己的凭据引用经 harness seam 解析，并以请求 `apiKey` 选项传入，pi-ai 将其视为优先级最高的 auth 覆盖——这正是明确失败引用语义的所在。该覆盖未覆盖的一切都经集合自身的 auth 到达 pi-ai：凭据存储持有登录写入、刷新轮换的记录（以 `llm-pi-ai/<provider id>` 寻址），auth context 回答提供方解析时提出的 ambient 问题。两者跨快照保持稳定，因此配置变更重建集合时不会忘记谁已登录。运行时 import 使用 pi-ai 的 provider、API 与 utility 入口；`src/models.ts` 提供本适配器所需的少量 model helper，而不会求值 pi-ai 聚合入口。

初始提示词文本和可用工具分别使用 pi-ai 的 `Context.systemPrompt` 与 `Context.tools`；后续系统消息和工具更新保留在 `Context.messages` 中。pi-ai 负责规范化这些字段，并应用所选协议的序列化规则。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | Config 快照、目录及路由注册 |
| [`src/auth.ts`](src/auth.ts) | 覆盖 harness 凭据平面的凭据存储与 ambient auth context |
| [`src/login.ts`](src/login.ts) | 面向提供登录的已安装提供方的授权流程 |
| [`src/config.ts`](src/config.ts) | Profile schema、解析与可服务性校验 |
| [`src/catalog.ts`](src/catalog.ts) | 已安装目录集成与漂移门禁 |
| [`src/models.ts`](src/models.ts) | 基于 pi-ai 窄入口的 model collection、静态 provider 与 reasoning level |
| [`src/provider.ts`](src/provider.ts) | 受支持协议表与提供方构建 |
| [`src/context.ts`](src/context.ts) | Harness 到 pi-ai 的上下文转换、图片处理、回放恢复 |
| [`src/stream.ts`](src/stream.ts) | 把 pi-ai 事件转换为 harness `StreamChunk` 值 |
| [`src/replay.ts`](src/replay.ts) | 带版本的 `ReplayEnvelope` 存储与校验 |
| [`src/discovery.ts`](src/discovery.ts) | 面向配置界面的端点询问 |

### 注册与目录

插件会在可配置提供方目录中声明它能认证的每个已安装目录提供方，并加入当前 profile 声明的每条路由，因此配置界面可以在任何路由存在之前提供完整目录。目录列出了模型却没有聊天模型的提供方（例如只有分类器模型）不进入目录，也不注册登录流程，因为本适配器只分派聊天请求。每个条目都携带 `declared`——pi-ai 是否在该键下不提供任何内容——因为只有适配器能区分手工声明路由与收窄目录路由。路由注册具有原子性：与其他适配器冲突的候选集合会让此前路由继续服务。零路由的裸挂载即休眠姿态：settings 分节提供 profile 前不注册任何内容，分节清空时路由随之消失。

### 回放与词汇

成功 assistant 响应会存储带版本的、无损 JSON 回放状态，与产生它们的提供方和模型放在一起——响应级事实加每个流式块一条逐块条目。请求时，`LlmRuntime` 仅当同一适配器实例拥有两条路由时才传递回放状态；适配器校验它并恢复原生响应 id、提供方签名与可选的 `providerThinkingLevel` effort 元数据，缺失的 effort 元数据仍保持缺失。回放会对照 assistant 来源校验请求模型身份，并用它保留同模型签名；提供方报告的响应模型仅作为诊断元数据。回放状态缺失或无法使用时会降级为提供方无关内容，并保留 assistant 来源中必需的提供方和模型。pi-ai 工具调用参数是解析后的对象，因此适配器解析输入并重新字符串化输出，以符合 harness 原始 JSON 约定；pi-ai 流内错误事件映射为终止 `finish` 分片。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | Config 快照、目录及路由注册 |
| [`src/auth.ts`](src/auth.ts) | 覆盖 harness 凭据平面的凭据存储与 ambient auth context |
| [`src/login.ts`](src/login.ts) | 面向提供登录的已安装提供方的授权流程 |
| [`src/config.ts`](src/config.ts) | Profile schema、解析与可服务性校验 |
| [`src/catalog.ts`](src/catalog.ts) | 已安装目录集成与漂移门禁 |
| [`src/models.ts`](src/models.ts) | 基于 pi-ai 窄入口的 model collection、静态 provider 与 reasoning level |
| [`src/provider.ts`](src/provider.ts) | 受支持协议表与提供方构建 |
| [`src/context.ts`](src/context.ts) | Harness 到 pi-ai 的上下文转换、图片处理、回放恢复 |
| [`src/stream.ts`](src/stream.ts) | 把 pi-ai 事件转换为 harness `StreamChunk` 值 |
| [`src/replay.ts`](src/replay.ts) | 带版本的 `ReplayEnvelope` 存储与校验 |
| [`src/discovery.ts`](src/discovery.ts) | 面向配置界面的端点询问 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从服务约定逐步进入孪生适配器与共享类型。

- [dsh-llm 服务](../llm/README.zh.md)——本适配器注册其上的提供方无关服务。
- [llm-deepseek 适配器](../llm-deepseek/README.zh.md)——`deepseek-official` 路由的 DeepSeek 直连孪生。
- [LLM 流式子系统](../../../docs/subsystems/llm-streaming.zh.md)——`StreamChunk` 协议与适配器约定。
- [llm-retry](../llm-retry/README.zh.md)——应用每个 profile `retryPolicy` 的重试执行器。
- [孪生 LLM 适配器](../../../.agents/notes/implemented/architecture/2026-06-13-twin-llm-adapters.zh.md)——为什么 DeepSeek 路由交付两个结构不同的适配器。
- [生成配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-llm-pi-ai)——每个受支持配置字段及其源声明。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      openai:
        apiKeyEnv: OPENAI_API_KEY
        baseURL: https://proxy.example.com:8443
        reasoning: high
        requestImagePixelBudget: 4194304 # total pixels; 2048 by 2048 default
        requestImageMaxBytes: 1048576    # raw bytes before base64 expansion
        maxRequestImageBytes: 20971520   # accumulated base64 payload
        retryPolicy:
          mode: normal
          maxRetries: 3
      anthropic:
        apiKeyEnv: ANTHROPIC_API_KEY
        models:
          - id: claude-sonnet-4-5
            contextWindow: 200000
      acme-gateway:
        displayName: Acme Gateway
        apiKeyEnv: ACME_GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.acme.example/v1
        compat:
          thinkingFormat: deepseek
        models:
          - id: acme-think
            name: Acme Think
            contextWindow: 262144
            reasoningEfforts:
              off:
              high: high
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `apiKeyEnv` | 无 | 按请求解析的凭据引用；省略时交由 pi-ai 环境发现 |
| `displayName` | 提供方名 | 选择器界面显示的标签 |
| `api` | 目录协议 | 协议格式；仅目录不提供的路由需要 |
| `baseURL` | 目录端点 | 路由上所有模型的端点 |
| `models` | 已安装目录 | 整体替换路由目录；每个条目从已安装模型取默认值 |
| `modelOverrides` | 无 | 重塑个别已安装目录模型，而不替换其余模型 |
| `compat` | 目录检测 | 无法识别端点的协议兼容开关 |
| `defaultContextWindow` | `262,144` | 未描述模型的容量回退 |
| `defaultMaxTokens` | `32,768` | 未描述模型的输出上限回退 |
| `requestImagePixelBudget` | `4,194,304` | 每张确定性请求图片的总像素预算 |
| `requestImageMaxBytes` | `1 MiB` | 每张请求图片在 base64 扩展前的编码字节目标 |
| `maxRequestImageBytes` | `20 MiB` | base64 图片载荷总上限，保留图片超过时请求以 `IMAGE_OFFLOAD_REQUIRED` 失败 |
| `retryPolicy` | normal，5 次重试 | 由 `dsh-llm-retry` 执行的提供方自有重试策略 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-llm-pi-ai
