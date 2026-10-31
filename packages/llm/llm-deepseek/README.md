---
title: "@deepseek-ai/dsh-llm-deepseek"
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

提供共享的 DeepSeek Messages 传输、请求配置和模型能力。组合 [API key](../llm-deepseek-api-key/README.zh.md) 或[账号](../llm-deepseek-account/README.zh.md)插件以提供鉴权、模型发现与 provider 注册。有效的设置更改在后续请求生效，进行中的请求保留原配置。本包可与 [pi-ai 适配器](../llm-pi-ai/README.zh.md)并用。

`resolveAuth(connection)` 返回提供方持有的鉴权请求头，以及绑定本次请求凭据的可选失败回调。Messages 和 Files 直接使用这些请求头，不判断凭据类型。上传复用按端点和鉴权请求头的哈希隔离，不持久化原始凭据。

---

## ⚡ 功能

### 适用场景

面向 DeepSeek 官方 API，或通过 `baseURL` 连接兼容 Messages 的网关时，选择本适配器。当同一组合还要通过 pi-ai 目录路由其他提供方或手工声明的网关时，选择 `dsh-llm-pi-ai`；两个适配器可以同时挂载，因为它们的路由名不冲突。为 `deepseek-official` 注册任何其他适配器会以 `DUPLICATE_ADAPTER` 失败。

### 限制

这些限制说明适配器在哪里停止、由未来工作接续。它们是当前包约束，不是通用 DeepSeek 对比或任务积压。

- **替换 `models` 会替换完整目录列表**——修改单个模型条目时使用路径编辑。
- **不映射 `tool_choice`**——不属于核心词汇（与 pi-ai 孪生共享）。
- **请求使用原始 `fetch`，而非 `@cordisjs/plugin-http`**——没有共享代理或拦截配置。
- **Messages 历史内 system 更新需要保留用户或工具结果轮次**——若更新后的全部用户输入都被省略，且前一个协议轮次是 assistant，序列化会在下一个 assistant 之前或请求结束处以 `UNSUPPORTED_CONTENT` 失败。文本或空工具结果可以保留该轮次。不支持将更新移到更早的轮次；[输入历史参考](README.zh.md)记录了排序约束。
- **图片是仅用于输入的持久附件**——不支持直接外部 URL 与 assistant 图片输出；DeepSeek 输入通常使用 Files API，仅在单次请求恢复时使用内联 base64。
- 默认目录公布 `deepseek-flash` 及其文本、图片和历史内更新能力，不探测网关可用性。网关开放该 ID 前，请求可能以 `INVALID_REQUEST` 失败。
- [adapter.e2e.ts](tests/adapter.e2e.ts) 与 [runtime.e2e.ts](tests/runtime.e2e.ts) 中的真实 API 检查需要 `DEEPSEEK_API_KEY`。将 `DEEPSEEK_IN_HISTORY_MODEL` 设为受支持的非空模型 ID 可运行 system 更新检查：适配器套件使用 `high` 思考强度，运行时套件则在关闭思考时比较缓存复用，可能受到指令遵循不稳定的影响。运行时图片用例还需要 `DEEPSEEK_FLASH_E2E=1` 或 `DEEPSEEK_VISION_E2E=1`。

---

## 📊 指标

### DeepSeek 请求

#### 模型看到什么

所选 DeepSeek 模型会收到 harness 系统提示词、消息历史、工具 schema、停止序列与调用配置（`maxTokens`、`reasoningEffort`、`temperature`），不包含适配器撰写的提示词散文。提供方专用请求扩展字段留在模型输入之外。视觉模型通常接收 Files API 引用形式的用户与工具结果图片，其旁带附件句柄和请求预览尺寸。当前执行文件系统可以映射附件提供方的宿主对象时，它还会收到规范化对象路径；描述符会把该副本标记为只读，并警告规范化可能缩放或重新编码上传内容。Files 解析失败时，全部保留图片改用内联 base64；超出预算的较旧图片则在占位文本中保留当前请求已解析的访问方式。此前 assistant 轮次的推理内容会原样传回，无论该轮次是否调用了工具。 对于非法 JSON 或非对象的历史工具参数，Messages 发送 `{}`。此参数兜底保留调用 ID、工具名和工具结果；原始参数仍保留在 Session 日志中。新生成的 Messages 工具参数仍须是有效 JSON 对象。 Messages 会省略用户消息和工具结果中的 `reasoning` 与 `tool-call` 块。这也允许回放包含助手输出的已保存子 Agent 通知；原始 Session 内容保持完整。转换后的空用户消息会被跳过，空工具结果则保留调用 id 和错误标记。其他不支持的输入块仍会以 `UNSUPPORTED_CONTENT` 失败。

#### Token 影响

提供方分词决定精确的文本与图片 token 输入。适配器声明按路由的 `imageRequestPricing`：把日志中的图片省略决策选中的每个出现位置按其占位文本计价，并按投影后的尺寸使用公开的视觉计量规则（14 px patch 网格、3:1 降采样、544×544 放大下限、单图 1024 token 上限）为每张保留图片计价。这使 token 计量服务可以在请求发出前为图片压力定价；上报的 usage 仍是权威值。推理回传会把每个推理轮次的思维链带进后续请求，而已省略的图片不再消耗视觉 token。保留的出现位置按精确请求版本字节超过 file 模式或内联回退预算（`maxRequestFilesBytes`、`maxImagesPerRequest` 与两个量子）的请求，以 `IMAGE_OFFLOAD_REQUIRED` 失败并说明还需省略多少最老的出现位置，由 `dsh-compaction-image-offload` 用 `image/offload` 事件记录所选位置并重试。可用时报告缓存读取用量。Messages 的 token 总数包含未缓存输入、输出、缓存读取与缓存写入 token。

#### KV Cache 影响

未改变的已组装前缀有资格获得 DeepSeek 缓存复用，本适配器会在用量中报告。确定性的请求图片字节并不意味着完整前缀固定不变：执行世界路径变化会改写历史描述符文本，刷新上传会替换 `file_id`，Files 到 base64 的回退也会改变图片表示。这些变化以及模型路由、提示词、schema、历史或图片预算变化，都可能从首个受影响 token 起阻止复用；推理回传在每个推理轮次上追加内容。在声明了 `systemPromptUpdate: in-history` 的目录条目上，同一请求序列延续期间的系统提示词变化会追加到已缓存历史之后，因此直到该历史末尾的前缀仍可复用；工具 schema 变化仍会从第一个改变的 token 起阻止复用。

### DeepSeek 响应

#### 模型看到什么

推理、文本与原始字符串工具参数会被翻译为 harness 分片，供 loop 记录并组装。

#### Token 影响

生成的 token 遵循请求中记录的推理强度与 `maxTokens`；只有 loop 保留的块会影响后续输入。

#### KV Cache 影响

loop 保留的响应块会追加到下一个请求，并保留其更早的可复用前缀；被丢弃的块不再有后续缓存影响。更换提供方或模型会选中不同的缓存域。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释适配器背后的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

插件建立在一个显式解析步骤与一条注册事实之上。`resolveAdapterOptions()` 是从原始配置到已校验连接事实的唯一路径，适配器通过 thunk 每次操作重新读取这些事实——基址、目录、请求默认值、图片与 Files 策略及空闲预算都会作用于下一个请求，而进行中的流保持其启动时的事实。注册时捕获的唯一事实是重试策略：解析值变化时，插件会在一个同步区段内原位重新注册路由，因此任何请求都观察不到空档。

### 源码导航

[`src/index.ts`](src/index.ts) 导出协议库；[`src/host.ts`](src/host.ts) 为 provider 插件绑定共享 Host 服务。[`src/adapter.ts`](src/adapter.ts) 管理请求生命周期；[`src/serialize.ts`](src/serialize.ts) 和 [`src/translate.ts`](src/translate.ts) 映射模型输入与流式输出。[`src/file-store.ts`](src/file-store.ts) 通过 [`src/files-api.ts`](src/files-api.ts) 管理上传复用与恢复。

### 协议流程

一次 `stream()` 调用通常发一条模型请求：解析确定性请求图片、优先使用 Files id、准备所有已注册顶层请求扩展、向解析后的 `baseURL` 发起 fetch、在 HTTP 2xx 后接受扩展事务，并把 SSE 流翻译为 harness 协议。文件解析失败会让首条请求使用内联模式；提供方的陈旧文件响应允许一次替换尝试，且替换解析失败时也使用内联模式。每条模型与 Files 调用都携带共享归因。模型请求还在模型输入之外携带稳定匿名用户 id，并在存在 session id 时携带该值。推理历史会按需序列化回请求，缓存计量则把 DeepSeek 的缓存命中指标映射进 harness 用量桶。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从服务约定逐步进入孪生适配器、重试执行器与共享类型。

- [dsh-llm 服务](../llm/README.zh.md)——本适配器注册其上的提供方无关服务。
- [llm-pi-ai 适配器](../llm-pi-ai/README.zh.md)——服务其他提供方与网关的库实现孪生。
- [LLM 流式子系统](../../../docs/subsystems/llm-streaming.zh.md)——`StreamChunk` 协议与适配器约定。
- [llm-retry](../llm-retry/README.zh.md)——应用本适配器 `retryPolicy` 的重试执行器。
- [DeepSeek 请求扩展](../deepseek-llm-api-extensions/README.zh.md)——提供方专用顶层字段的生命周期与接受语义。
- [会话日志上传](../../session/session-log-deepseek/README.zh.md)——默认启用的增量 `dsh_session_log` 贡献。
- [插件包清单](../plugin-package-inventory-deepseek/README.zh.md)——默认启用的 `dsh_plugin_packages` 贡献。
- [孪生 LLM 适配器](../../../.agents/notes/implemented/architecture/2026-06-13-twin-llm-adapters.zh.md)——为什么 DeepSeek 交付两个结构不同的适配器。
- [强制应用归因标头](../../../docs/subsystems/llm-streaming.zh.md)——每个提供方请求携带的身份。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY  # credential reference, resolved per request
    reasoningEffort: high        # optional; off | low | high | max
    maxTokens: 256000            # optional per-request output cap
    maxRequestFilesBytes: 134217728
    maxInlineRequestImageBytes: 20971520
    maxImagesPerRequest: 600
    filesApiTimeoutMs: 60000
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `baseURL` | `https://api.deepseek.com/anthropic` | 显式值优先，其次为 `$DEEPSEEK_BASE_URL`，最后为官方根地址 |
| `thinking` | `enabled` | 部署策略；`disabled` 把所有请求锁定为 `off` |
| `reasoningEffort` | `high` | 默认强度：`off`、`low`、`high` 或 `max` |
| `maxTokens` | `256,000` | 单次请求输出上限；模型自身上限与显式请求值优先 |
| `defaultContextWindow` | `1,000,000` | 无精确值模型的容量回退 |
| `models` | V4.1 Flash + V4 Pro | 供发现消费方查看的建议性目录 |
| `streamIdleTimeoutMs` | `300,000` | 单次流读取未完成的最大提供方空闲时间 |
| `maxRequestFilesBytes` | `128 MiB` | file 模式请求图片字节预算，保留图片超过时请求以 `IMAGE_OFFLOAD_REQUIRED` 失败 |
| `maxInlineRequestImageBytes` | `20 MiB` | 独立的 base64 回退高水位 |
| `maxImagesPerRequest` | `600` | 保留请求图片数量的高水位 |
| `imageOffloadByteQuantum` | `64 MiB` | Files 模式最旧前缀移除量子 |
| `inlineImageOffloadByteQuantum` | `10 MiB` | 内联模式最旧前缀移除量子 |
| `imageOffloadCountQuantum` | `20` | 数量超限移除量子 |
| `filesApiTimeoutMs` | `60,000` | 每张图片 Files 解析截止时间 |
| `fileExpiresAfterSeconds` | `604,800` | 请求的上传图片生存期与本地复用期限 |
| `fileRefreshMarginSeconds` | `3,600` | 低于此剩余复用期时替换 id |
| `fileQuotaCleanupBatch` | `100` | 配额重试前删除的、归 harness 所有的最旧文件数 |
| `retryPolicy` | normal，5 次重试 | 由 `dsh-llm-retry` 执行的提供方自有重试策略 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-llm-deepseek
