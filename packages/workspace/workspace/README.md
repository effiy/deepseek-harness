---
title: "@deepseek-ai/dsh-workspace"
tags: []
category: "workspace"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用此包可以维护一个有序、持久的项目目录列表，以及在每个目录中运行的会话。宿主可以构建项目侧边栏、在不删除历史的情况下把会话从分组中隐藏，并在不删除文件夹、文件或会话的情况下移除项目。重新添加已移除的目录会创建一个全新项目，而目录无法校验的会话会保持 Ungrouped。需要持久项目分组的 GUI 或宿主工作流适合使用它；它对模型不可见，不增加提示词或请求上下文成本，但需要会话持久化与存储后端。

---

## ⚡ 功能

### 限制

这些限制说明项目列表何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是任务积压。

- **移除绝不删除数据**——移除项目会保留其文件夹、文件与会话历史；这些会话变成 Ungrouped，而会话删除与文件夹移除是彼此独立且尚未提供的功能。
- **只有带记录目录的会话才能加入**——只有记录中带有可解析为项目路径的目录的会话才属于项目；没有目录的会话保持 Ungrouped，来自其他目录的会话无法移入。
- **外部变更延迟可见**——如果另一进程删除或损坏目录，项目只能在下次刷新或重启后反映出来。
- **归档与取消归档执行不同的会话校验**——恢复只是从归档集合中移除 id，因此会话已不存在的条目仍能取消归档，也不会留下未知引用；对未归档 id 执行恢复不写盘即完成，而 `archiveSession` 会拒绝既非实时也未持久化的会话。
- **活动检查与归档写入不是一个原子步骤**——在提供方作答与持久化写入之间开始的回合会在隐藏状态下运行，`agent/pre-step` 先于该写入的每个模型步连同其工具调用照常执行；API Session Controller 的门禁把写入之后提出的第一步以 `blocked` 收口，因此暴露面以该写入的时延为界，实际上是一个模型步。
- **重新添加目录从空开始**——移除后再次添加同一目录会创建空会话列表的新项目；旧会话不会自动回来。

---

## 📊 指标

### Workspace 记录与会话记账

#### 模型看到什么

没有。`ctx.workspaceRegistry` 只向宿主侧消费方提供 workspace 记录：此包不注册工具、不注入提示词、不写入会话事件，因此没有请求字段会携带此包数据。

#### Token 影响

每个请求的直接 token 为零。

#### KV Cache 影响

与实时请求无关：此包绝不触及请求前缀，因此不会使提供方缓存复用失效。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释此功能背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

- **每个规范路径一条记录。** `fs.realpath` 是唯一的一套唯一性规范：路径以规范化形式存储，因此指向已有记录目录的符号链接会与之冲突，唯一性即规范路径的字符串相等。
- **成员资格是所有权加实时 cwd 事实。** 记录的 `sessionIds` 顺序是所有权真源；启动时的头部索引校验它，`sessionIds` 在读取时过滤，下一次变更会持久化剪除无效项。
- **仅读取头部。** 引导与 attach 校验只读取 `SessionHeader` 字段；事件正文绝不加载。
- **两次写入的变更带显式标记。** 创建与删除在记录/顺序对可能分叉之前先持久化 `pendingMutation` 标记，因此启动只补全被中断的操作，未标记的分叉作为损坏明确报错。
- **串行化写入。** 注册表操作跑在同一条操作链上；实体变更通过领域写链上的 `table.update` 执行，写入 `updatedAt`，并在其所在的链位置决定成员资格。

---

## 📁 目录

「待补充」

---

## 🔗 资源

当本包的视角不够用时阅读以下页面：子系统参考是权威的功能约定，Agent Note 记录了项目为何从会话历史起步、以及移除为何是非破坏性的。

- [Workspace 子系统](../../../docs/subsystems/workspace.zh.md)——项目及其会话的功能约定，以及 workspace 服务的生成 API。
- [Workspace 包映射](../README.zh.md)——本组唯一的包及其仓库位置。
- [领域 KV 存储 Agent Note](../../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.zh.md)——为什么项目记录使用领域数据形式。
- [Workspace UI 产品流 Agent Note](../../../.agents/notes/archived/feature/2026-07-25-workspace-ui-product-flow.md)——首次启动如何从会话历史构建项目，以及 GUI 如何排序。
- [历史删除 Workspace 注册记录决策](../../../.agents/notes/archived/feature/2026-07-27-workspace-registration-deletion.md)——为什么移除项目绝不会删除其文件夹或会话。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-session'
- name: '@deepseek-ai/dsh-session-persistence-jsonl'
- name: '@deepseek-ai/dsh-storage'
- name: '@deepseek-ai/dsh-storage-json'
- name: '@deepseek-ai/dsh-storage-domain'
  config:
    backend: json
- name: '@deepseek-ai/dsh-workspace'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`WorkspaceRegistry` 服务、头部索引、引导、操作串行化 |
| [`src/entity.ts`](src/entity.ts) | 包私有 `Workspace` 实现及其唯一的 `mutate` 写入路径 |
| [`src/spec.ts`](src/spec.ts) | 领域声明：记录 schema、注册表状态、`defineDomain` 规范 |
| [`src/types.ts`](src/types.ts) | 公开 `Workspace` 接口与 `WorkspaceId` 品牌 |
| [`src/paths.ts`](src/paths.ts) | `realpath` 唯一性规范 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-workspace
