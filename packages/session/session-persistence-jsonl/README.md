---
title: "@deepseek-ai/dsh-session-persistence-jsonl"
tags: []
category: "session"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-session-persistence-jsonl` 把每个会话存为当前的仅追加 JSONL 日志，并保留不可变的历史格式 generation——默认以带校验和的 Zstandard 帧存储，禁用压缩时以换行分隔的原始文本行存储。它通过持久化句柄提供当前逻辑 `SessionEvent` 流，因此格式迁移、压缩、历史解码与崩溃恢复仍是存储内部细节。当消费方需要按会话的磁盘文件时选择它；选择 `compression: 'none'` 后日志可作为纯文本按行读取。根目录是唯一必填配置；持久性、延迟实体化、[受支持的历史格式迁移](../session-format-catalog/README.zh.md)与撕裂尾部崩溃恢复都随后端提供。

---

## ⚡ 功能

### 适用场景

当消费方受益于每会话一份产物——导航、外部工具或可逐行读取的原始日志——时选择此后端。它是唯一的第一方会话持久化提供方。后端把会话保存在部署控制的根下：项目本地、共享、临时或集中式。

### 限制

这些限制说明本后端何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是任务积压。

- **格式迁移保留已配置编码，且只支持 catalog 中的链**——本 build 把受支持的历史代迁移到当前格式；更改压缩需要独立根，保留的旧版本不提供自动 fallback 或 downgrade 支持。
- **平铺文件存储布局不加载**——加载前使用独立根，或将预发布产物移入项目/会话目录布局。
- **压缩文件不能直接按行读取**——使用后端加载；或在写入新根前选择 `compression: 'none'`，供外部行读取方使用。
- **不删除会话文件**——日志在 `root` 下累积，直到外部移除；seam 无删除接口。
- **每会话一个活动写入方**——写句柄认领在所属后端实例内排除第二个写入方，内核锁（`session.lock` 上的非阻塞 `flock(2)`；Windows 上为由该路径派生的命名内核信号量，零文件系统足迹）排除其他所有实例与进程；锁在以写模式打开既有产物时立即获取，新建会话则仅在首次实体化写入之前获取，因此未实体化的会话不留任何文件系统足迹。崩溃持有者的锁随其进程消亡，会话立即可再写入，而活着但卡死的持有者会阻塞写入方直到其进程退出（POSIX 上删除锁文件即放弃该排他；释放本身从不删除它）。咨询式 `flock` 在部分网络文件系统（NFSv3）上不可靠，Windows 信号量名按登录会话隔离。
- **POSIX 实体化需要硬链接支持**——第一次 append 使用 `link()`，使同 id 竞态失败而不覆盖已提交日志；Windows 使用无替换 write-through rename。
- **POSIX 写入需要匹配的预编译系统 addon**——[`node-addon-system`](../../../native/system/README.zh.md) 提供异步 flock，无须在用户侧编译。addon 缺失时拒绝写入所有权；Windows 保留其信号量实现。

---

## 📊 指标

### 恢复的对话历史

#### 模型看到什么

JSONL 存储不会向实时请求提供提示词或 schema。加载会恢复已存储的表层历史，并保留之前的请求 header 用于重建；新 loop 组合当前 envelope。恢复会用 `TOOL_NOT_STARTED` 平衡没有持久调用的 assistant 请求；持久调用无结果时则变为 `TOOL_OUTCOME_UNKNOWN`，它要求模型只重试只读或幂等工作，并验证可能的副作用或询问用户。嵌入式 Assistant stream 与仅日志 attempt 不会重复生成消息。

#### Token 影响

实时请求不新增 token。恢复后的 agent（智能体）会因保留的历史、当前 envelope，以及每个中断调用中以引用形式加入的修复结果文本而消耗 token。

#### KV Cache 影响

JSONL 存储不修改实时请求前缀。只有重建历史、当前 envelope 与模型路由匹配时，恢复 loop 才能重用提供方缓存；崩溃修复结果仅追加。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节说明物理编码与写入路径；可观察约定已在[使用本包](#use-this-package)中说明。

### 设计理念

该后端拥有自己完整的存储运行时（`src/storage.ts`）：`JsonlSessionHandle` 承载逐句柄修改链、带固定批处理窗口与 single-flight 排空的已路由实时事件缓冲、单调读取与幂等 close；一个 tracker 持有进程内单写者认领、teardown 清扫所遍历的打开句柄集合，以及后端自己的会话监听器所路由进的已创建但未实体化待定会话。历史正文读取共享每个 Session 唯一的一次 Decode/Migrate preparation，按 revision 为键的有界 memo 让紧接的观察到恢复交接复用该解析；backend 在 memo 化前只对每个 event graph 深度冻结一次，因此后续 handle read 无需复制或再次冻结。只有写 open 才发布准备好的后继。本包有意只暴露默认插件导出与配置类型——具体类不是具名导出，因此消费方只耦合 `ctx.sessionPersistence`，其可观察行为由共享 seam 测试套件（`runPersistenceContract`/`runLiveWritePathContract`）钉住。物理修订号组合 device、inode、size 与纳秒时间戳，供准备缓存、稳定读取重试及发布检查使用。历史格式的公开修订号还加入所选路径排序后及其物理修订号的 SHA-256 指纹；锁文件与保留但未被选中的代际不参与计算。

### 物理编码

默认产物是独立 Zstandard 帧 的标准拼接：一个仅包含 header 行的带校验和帧，后跟每个持久 append 批次一个带校验和帧，使用 Node 内置 Zstandard API 的默认压缩级别（无级别开关）。当前格式为每个事件写一行；`sourceEventSeqs` 使用无损存储形式：至少包含三个序列号的连续段会变成 `[start, end]` 区间对，其他列表原样保留；读取时会展开回精确的内存数组。历史迁移会复用一个 Zstandard decoder，让已解析行流经有状态格式 Stage，并通过一个压缩 context 以约 1 MiB 主线程分片流式写入当前记录，同时只保留最终当前事件、有界 decoder 状态与必需的序号重映射表。列表只读取并验证 header 帧。`compression: 'none'` 保留相同的存储形式逻辑行，但不使用帧压缩。一个根只属于一种编码：启动发现与定向查找会拒绝使用另一后缀的 generation；格式迁移保留已配置编码，而压缩转换、混合根回退与双写仍不受支持。冻结的 v0 与 v1 codec 仅为历史 generation 保留 packed-row decoder。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config` schema、后端服务类与文件存储原语 |
| [`src/storage.ts`](src/storage.ts) | JSONL 句柄、已路由实时事件缓冲、进程内写入者记账、监听器、teardown |
| [`src/format.ts`](src/format.ts) | 日志路径派生、header 编码与当前记录扫描 |
| [`src/generation.ts`](src/generation.ts) | 单遍历史还原、有界 stage 编码、源 revision 检查与排他后继发布 |
| [`src/migration-verifier.ts`](src/migration-verifier.ts) | stage 与竞争 generation 校验的 Worker 生命周期 |
| [`src/zstd.ts`](src/zstd.ts) | Zstandard 帧压缩、解码与帧扫描 |
| [`src/win32.ts`](src/win32.ts) | Windows write-through 发布与目录创建 |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config` schema、后端服务类与文件存储原语 |
| [`src/storage.ts`](src/storage.ts) | JSONL 句柄、已路由实时事件缓冲、进程内写入者记账、监听器、teardown |
| [`src/format.ts`](src/format.ts) | 日志路径派生、header 编码与当前记录扫描 |
| [`src/generation.ts`](src/generation.ts) | 单遍历史还原、有界 stage 编码、源 revision 检查与排他后继发布 |
| [`src/migration-verifier.ts`](src/migration-verifier.ts) | stage 与竞争 generation 校验的 Worker 生命周期 |
| [`src/zstd.ts`](src/zstd.ts) | Zstandard 帧压缩、解码与帧扫描 |
| [`src/win32.ts`](src/win32.ts) | Windows write-through 发布与目录创建 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从共享持久化模型逐步进入同级后端与物理格式决策。

- [会话持久化子系统](../../../docs/subsystems/persistence.zh.md)——后端无关的服务语义与提供方关系。
- [会话持久化 seam](../session-persistence/README.zh.md)——本后端实现的服务约定。
- [已发布 Session 格式迁移](../../../.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.zh.md)——不可变 generation、相邻迁移边与发布规则。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-session'
- name: '@deepseek-ai/dsh-session-persistence-jsonl'
  config:
    root: /absolute/path/to/session-logs
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `root` | 必填 | 所有会话文件的根目录 |
| `compression` | `'zstd'` | 物理编码：`'zstd'` 带校验和帧，或 `'none'` 换行分隔 UTF-8 文本 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-persistence-jsonl
