---
title: "@deepseek-ai/dsh-session-query-sqlite"
tags: []
category: "session-query"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用本包可为会话历史增加带排序的 SQLite FTS5 搜索，既能跨会话搜索，也能在单个会话内搜索，并支持游标分页。它把实时与持久化历史索引到独立的派生数据库，因此搜索反映当前状态，同时不会修改会话持久化存储。精确读取、过滤与追踪仍通过同一查询 API 提供。已发布组合中的搜索是可选能力；配置 `openAt` 可让索引在启动时、首次搜索时打开，或永不打开。结果匹配 token 与短语，而非任意子字符串；每个索引路径只能由一个进程持有。

---

## ⚡ 功能

### 适用场景

当你想对既往会话进行带排序与分页的全文召回时选择它。它与 `dsh-session-query` 和会话服务一起使用；持久化后端可选但建议挂载，这样重启后持久化历史仍可搜索。不要把 `path` 指向 session-persistence 数据库——本包拥有独立的派生索引。

### 限制

这些限制说明本包何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是通用 SQLite 对比或任务积压。

- **无调用方授权**——这是上下文范围内的可信服务；模型工具或 UI 必须强制执行自己的访问策略。
- **同步查询执行**——`DatabaseSync` 在 MATCH 执行期间会阻塞 JavaScript 线程，且无法中断已运行的语句。
- **Token 召回，而非任意子字符串**——`unicode61` tokenizer 不会匹配更大 token 中的子字符串；对字面扫描使用 `filterEvents()`。
- **单一所有者的派生索引**——每个索引路径必须仅归一个进程中的一个服务所有；不支持外部写入者与多进程共享。

---

## 📊 指标

无，因为该搜索后端只向调用方返回命中，且不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释后端背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本后端建立在一个分离与三项承诺之上：

- **派生索引，绝不动源存储。** FTS 行存放在专用可丢弃数据库中；这里的代码从不打开 session-persistence 数据库。
- **实时优先的观察。** 一个串行化状态机比较持久化快照修订，只通过短生命周期读取句柄读取新增或已更改日志，并在一个事务中对账，因此搜索反映最新的稳定状态。
- **世代绑定的游标。** 每次语料库变化都会递增世代；游标携带其创建时的世代，宁可陈旧失败也不返回偏移后的页面。
- **字面短语即数据。** 调用方查询文本被引成一个 FTS5 短语，查询语法保持惰性；保留高亮标记在索引前从文档中剥离。

设计历史记录在 [SQLite FTS5 会话搜索笔记](../../../.agents/notes/archived/feature/2026-07-10-sqlite-session-query-provider.md)与[统一服务决策](../../../.agents/notes/archived/architecture/2026-07-23-unified-session-query-service.md)中。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务：配置、openAt 生命周期、串行化对账、查询执行、游标 |
| [`src/query.ts`](src/query.ts) | 请求规范化、参数化谓词、摘录、谓词与绑定预算 |
| [`src/schema.ts`](src/schema.ts) | 数据库 schema、application id 归属、原地重置、仅所有者文件创建 |

### 索引生命周期

持久化 FTS 行存放在专用派生数据库中并跨重启保留；实时会话使用连接本地 TEMP 表，遮蔽同一会话的持久化基库，并在实时所有者脱离后再次显示基库。两类表都在数字 `seed_length` 中保留精确继承切点；重建的 header 只公开 `isSeeded`，而切点参与实时指纹与持久来源修订。每次搜索执行一次串行化观察：列出持久化快照、把逐会话修订与已索引行比较、只通过读取句柄读取新增或已更改日志（在内存中补齐被中断的末尾轮次，从不写回）、提取语义文档，并在运行查询前于一个事务中提交对账。重复查询与不变的重新打开不读取任何内容；切换存储或观察到新增、已更改、已删除或经外部修复的来源时，会在下次稳定观察时对账。来源或事务失败不提交任何内容，下一次搜索重试。

### Schema 归属

数据库携带 application id 与 schema 版本 8。打开时拒绝其他应用程序拥有的文件或规范数据库，拒绝未知用户表；只有已识别的不兼容派生 schema 才会原地重置——因此不相关或 session-persistence 数据库绝不会被触碰。在 POSIX 文件系统上，缺失的目录与数据库文件以仅所有者可访问的方式创建（进程 umask 前为 `0700` 与 `0600`）。每个派生索引路径在一个进程中只能由一个服务拥有；世代与 TEMP 遮蔽状态由连接持有。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放设计问题与尚未决定的探索方向。它明确不具权威性——已交付的行为、限制与既定理由以上文、包代码和相关 Agent Note 为准。

#### 未来：其他 tokenizer 与搜索提供方

`unicode61` tokenizer 的选择牺牲子字符串召回，以换取较小的索引体积与双字符 token 支持；trigram 备选方案经实测后被否决。切换 tokenizer 或增加另一个搜索后端会改变索引召回，并需要各自的对账与世代方案。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务：配置、openAt 生命周期、串行化对账、查询执行、游标 |
| [`src/query.ts`](src/query.ts) | 请求规范化、参数化谓词、摘录、谓词与绑定预算 |
| [`src/schema.ts`](src/schema.ts) | 数据库 schema、application id 归属、原地重置、仅所有者文件创建 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从共享查询服务逐步进入类型级约定与设计证据。

- [会话查询子系统参考](../../../docs/subsystems/session-query.zh.md)——本后端实现的完整类型级约定。
- [dsh-session-query](../session-query/README.zh.md)——服务定义：本后端继承的精确读取、过滤与追踪。
- [dsh-tool-session-query](../../experimental/tool-session-query/README.zh.md)——调用这些搜索方法的面向模型消费方。
- [SQLite FTS5 会话搜索](../../../.agents/notes/archived/feature/2026-07-10-sqlite-session-query-provider.md)——搜索语义、对账与 tokenizer 决策。
- [JSONL 会话持久化](../../session/session-persistence-jsonl/README.zh.md)——本可丢弃索引观察的权威 Session store；其 root 必须与本包的数据库路径分开。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-session'
- name: '@deepseek-ai/dsh-session-query-sqlite'
  config:
    path: /absolute/path/to/session-search.db
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `path` | 必填 | 专用派生索引 SQLite 路径，或 `:memory:`；POSIX 上缺失的路径会以仅所有者可访问的方式创建 |
| `openAt` | `startup` | `startup` 在激活时打开；`first-search` 把 SQLite 模块推迟到首次搜索；`never` 关闭全文搜索，继承的读取保持可用 |
| `journalMode` | `wal` | `wal`、`delete`、`truncate` 或 `persist` |
| `defaultLimit` | `20` | 请求省略 `limit` 时的分页大小 |
| `maxLimit` | `100` | 接受的最大请求分页大小 |
| `snippetChars` | `240` | 按 Unicode 码点计算的最大 snippet 长度 |
| `readWindowMax` | `50` | 继承的 `readEvent()` 的 `before`/`after` 原始事件数上限 |
| `persistedReadConcurrency` | `4` | 继承批量读取的并发持久化日志读取数 |
| `preparedSessionCacheSize` | `5` | 继承的 `observeSession` 读取器为复用保留的冷 prepared-Session 观察数 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-query-sqlite
