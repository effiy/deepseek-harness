---
title: "@deepseek-ai/dsh-tool-fs-search"
tags: []
category: "fs"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用 `dsh-tool-fs-search` 为模型提供本地工作区中的 `glob` 文件发现与 `grep` 内容搜索。搜索无需在宿主上安装 `rg`，也无需文件系统提供方；结果相对于工作目录，并包含隐藏与忽略文件但排除 VCS 元数据。可配置上限约束内联输出；挂载可选 spill 存储后，达到上限的结果仍可完整恢复。若需读取、写入或编辑文件，请选择同级 `dsh-tool-fs` 包。

---

## ⚡ 功能

### 限制

这些限制说明搜索工具何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是通用搜索对比或任务积压。

- **搜索与文件访问没有共享工作区证明**——只有当工作目录与文件系统根目录指向同一工作区时，返回路径才可继续读取；本包不执行运行时跨服务校验。
- **打包二进制固定在依赖版本上**——Node 部署使用 `@vscode/ripgrep` 选择的版本；Python 单文件运行时将对应目标的原生版本复制为必需的 `-rg` 伴随文件。不支持的平台或损坏的安装会以 `SEARCH_FAILED` 使调用失败，Python 运行时包则会在启动前拒绝缺少伴随文件的安装。远程或虚拟文件系统需要共置的工作区或另一个搜索消费方。
- **schema 只暴露一个有界页面**——偏移分页、大小写开关、替代输出模式与提供方支撑的发现仍不在本包范围内；达到上限的完整输出需要 spill 后端。
- **启用采样时仅按搜索根正下方的第一段路径分组**——超过上限的 `glob` 页面在这些顶层条目之间平衡，因此集中在更深处的结果在该层级之下仍会呈现不均；递归平衡被延期。

---

## 📊 指标

### 系统提示词

#### 模型看到的内容

组装时，每个段落通过 `ctx.tools.get(name, scope)` 检查对应工具，仅在其可见时输出。grep 段落仅在 read 可见时包含后续使用 read 的句子。同一受支持工具集合下，原文和段落顺序保持不变，包括通过 `run_code` 暴露的 PTC 能力。 这种按 scope 选择文本的机制适用于系统提示词段落。工具 schema 描述仍是注册时的文本，不提及其他工具。

##### Glob 指导

```markdown
Use the glob tool — not shell find — to discover files by path pattern.
```

##### Grep 指导

```markdown
Use the grep tool — not shell grep or rg — to search file contents. Use read on a matched file when you need surrounding context.
```

#### Token 影响

指导成本取决于可见工具；必填的采样选择决定采用哪一个 glob 变体。

#### KV Cache 影响

可见工具集合、插件作用域、采样选择与指导文本不变时前缀稳定。限制、激活、dispose（资源释放）或改变选择可能从首个变化的段落开始使复用失效。

### 工具 schema

#### 模型看到的内容

glob 描述声明了配置的超过上限排序方式。生成的 [`glob` 和 `grep` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-fs-search) 使用 `sampleOverCapGlobResults: true`；工具无条件注册。

#### Token 影响

工具可见时每个请求有固定的 schema 成本。

#### KV Cache 影响

工具可见性与定义不变时前缀稳定。注册生命周期或作用域限制可能从第一个改变的 schema token 起使复用失效。

### 结果与 spill 提示

#### 模型看到的内容

`glob` 每行返回一个路径；`grep` 在每个路径下分组展示 `Line <line>: <preview>` 匹配。空搜索返回 `No files found` 或 `No matches found`。达到上限的结果以省略计数结尾，并附 spill locator 与后端检索提示，或说明完整结果无法保存。启用 `sampleOverCapGlobResults: true` 时，超过上限的 `glob` 页面按实际搜索根正下方的条目轮转取路径，页脚说明采样依据及其覆盖的顶层条目数；`false` 时页面是按修改时间排序的前部，并保留普通的上限结果页脚。spill 产物始终持有按修改时间排序的完整列表。

#### Token 影响

内联路径与匹配受 `globMaxResults`、`grepMaxMatches` 与 `grepMaxLineBytes` 约束；调用及其保留结果在压缩（compaction）前留在历史中。

#### KV Cache 影响

仅追加；新可见内容跟在可复用请求前缀之后，不会使既有 KV Cache 条目失效。

### 工具错误

#### 模型看到的内容

失败被规范化为 `Error: <message>`，并携带结构化 `SEARCH_INVALID_PATTERN`、`SEARCH_FAILED`、`SEARCH_RAW_OUTPUT_OVERFLOW` 或 `SEARCH_ABORTED` 元数据供调用方使用。

#### Token 影响

只有失败的调用会增加这些保留 token。

#### KV Cache 影响

仅追加；新可见内容跟在可复用请求前缀之后，不会使既有 KV Cache 条目失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释搜索工具背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本地工作区发现天然是由进程支持的 `rg` 工作流；如果把搜索放到 `ctx.fs` 上，就会迫使每个文件系统后端扩展搜索 API。subprocess seam 负责 spawn 执行、进程树终止、环境清理与有界输出捕获；本包负责 schema、参数校验、argv 构造、解析、保留、格式化结果 spill 与超时声明。工具绝不暴露后台任务——只有在 `rg` 退出、被协作式超时终止、被中止或失败后，调用才会返回。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config`、工具组合、上限校验 |
| [`src/glob.ts`](src/glob.ts) | `glob` schema、argv、解析、内联采样、格式化 |
| [`src/grep.ts`](src/grep.ts) | `grep` schema、argv、`--json` 解析、预览保留、格式化 |
| [`src/search-core.ts`](src/search-core.ts) | 共享 spawn 助手、`SEARCH_*` 错误、spill 交接、工作目录相对展示 |
| [`src/presentation.ts`](src/presentation.ts) | 搜索卡片元数据投影 |
| [`src/direct-call.ts`](src/direct-call.ts) | spill 后处理的直接调用结果接受 |

### 搜索如何运行

每次调用解析打包二进制（`@vscode/ripgrep`，或 pkg 单文件运行时中可执行程序的 `-rg` 伴随文件），前置 `--no-config`，使宿主的 `RIPGREP_CONFIG_PATH` 无法向不受约束的 spawn 注入 `--pre` 预处理器，并把每个模型控制的值作为普通 argv 元素传入——不存在 shell 层，因此不涉及 shell 引号处理。collect 模式预算限制完整 stdout 与 stderr 尾部；lossy stdout 读取以 `SEARCH_RAW_OUTPUT_OVERFLOW` 失败，而不是解析静默不完整的流。工具从不读取原始 spill 路径。

### 两类预算、两类产物

原始 stdout 与 stderr 是内部传输细节；工具始终把完整结果收集到内存中，只有内联页面设有上限。当调用产生超过内联上限的逻辑结果时，尽力而为的 spill 会把完整格式化预览保存到 spill 存储，页面携带其 locator；完整值不会进入模型上下文的分派则跳过 spill。spill 缺失或失败时保留内联页面，并报告完整结果无法保存——绝不会成为错误。收集与 spill 交接位于 `src/search-core.ts` 与 `src/presentation.ts`。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config`、工具组合、上限校验 |
| [`src/glob.ts`](src/glob.ts) | `glob` schema、argv、解析、内联采样、格式化 |
| [`src/grep.ts`](src/grep.ts) | `grep` schema、argv、`--json` 解析、预览保留、格式化 |
| [`src/search-core.ts`](src/search-core.ts) | 共享 spawn 助手、`SEARCH_*` 错误、spill 交接、工作目录相对展示 |
| [`src/presentation.ts`](src/presentation.ts) | 搜索卡片元数据投影 |
| [`src/direct-call.ts`](src/direct-call.ts) | spill 后处理的直接调用结果接受 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从工具逐步进入 subprocess seam、spill 存储与文件系统家族。

- [文件系统子系统](../../../docs/subsystems/filesystem.zh.md)——穷尽式提供方约定、策略事件与错误分类体系。
- [tool-fs](../tool-fs/README.zh.md)——用于后续读取的同级 `read`/`write`/`edit` 工具。
- [子进程能力](../../../docs/subsystems/subprocess.zh.md)——这些工具执行所经由的 spawn seam。
- [Spill 存储](../../spill/spill/README.zh.md)——使达到上限结果可完整恢复的可选后端。
- [超时工具](../../util/timeout/README.zh.md)——终止宽限期的 `MAX_TIMER_DELAY_MS` 上限。
- [生成工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-fs-search)——本包注册的穷尽式 schema。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-subprocess-local'
- name: '@deepseek-ai/dsh-tool-fs-search'
  config:
    sampleOverCapGlobResults: false
- name: '@deepseek-ai/dsh-spill-local'
```

### 参数

| 工具 | 参数 | 行为 |
|---|---|---|
| `glob` | `pattern`、`path?` | 查找路径匹配 glob 模式的文件，包含隐藏与忽略文件但排除 VCS 元数据；不含 `/` 的模式匹配任意深度的基名，因此 `*` 匹配整棵树；完整结果保持按修改时间排序 |
| `grep` | `pattern`、`path?`、`include?` | 用 ripgrep 正则搜索文件内容，并按文件分组返回 `Line N: <preview>` 匹配；`include` 是一个正向 glob 过滤器，逗号分隔列表与否定值会被前置拒绝 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-tool-fs-search
