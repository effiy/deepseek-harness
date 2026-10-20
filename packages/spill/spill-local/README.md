---
title: "@deepseek-ai/dsh-spill-local"
tags: []
category: "spill"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`dsh-spill-local` 把调用方的超大文本保存到宿主文件系统中私有的会话级文件，并以该文件路径作为定位信息返回，同时给出告诉模型读取或搜索它的取回指引。只要组合需要在 agent（智能体）运行所在的同一台机器上进行 spill 存储，就挂载它。文件对当前用户私有、名称不可预测，且每个会话的文件归入稳定的目录，因此共享根目录既不会泄露输出，也不会被预置的符号链接重定向。配置选择根目录与启动清理保留期；预览与 spill 决策由其他包负责。

---

## ⚡ 功能

### 限制

这些限制说明本地后端何时不合适或需要特别的运维注意。它们是当前的包约束。

- **长期运行的部署要等到重启才会被扫描**——一次性扫描只在激活后运行，因此运行期间超过年龄截止值的文件会在下次启动时回收。
- **定位信息需要与其位于同一文件系统的消费方**——远程或虚拟部署需要另一个 `SpillStore` 后端，其定位信息与取回提示在该环境中有明确含义。

---

## 📊 指标

间接地，通过把已保存文件路径与 read/grep 取回指引渲染给模型的 spill 消费方。

#### KV Cache 影响

无直接失效；请求前缀变更由上述消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释此后端背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

后端只负责存储细节，建立在一个原则之上：**spill 产物必须私有且不可重定向**。根目录私有（0700）、会话目录是稳定哈希、文件名不可预测、写入采用排他且仅所有者模式。存储机制放在与 Cordis 无关的模块中，以便无需上下文即可单元测试。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config`、`LocalSpillStore` 服务、清理生命周期、定位信息与取回提示的组装 |
| [`src/cleanup.ts`](src/cleanup.ts) | 一次性按年龄扫描、文件系统身份检查、符号链接和所有权保护 |
| [`src/store.ts`](src/store.ts) | 与 Cordis 无关的存储机制：私有根目录、会话目录、安全名称编码、排他写入 |

### 文件命名与写入

`suggestedName` 是不可信输入，因此 `encodeSegment` 会把 `[A-Za-z0-9._-]` 之外的每个字符以及 `~` 本身转义成 `~XXXX` 形式，使映射对所有 JS 字符串都是单射：分隔符、`../`、NUL 与绝对路径永远无法逃出单个路径段，整段 token `.`/`..` 也会被转义。写入采用 `open(path, 'wx', 0o600)`——任何已存在路径（无论是否符号链接）都会失败，因此预置目标无法重定向写入。对同一建议名的两次保存会得到不同的随机前缀。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放方向。它明确不具权威性。

#### 未来：工作区隔离的交互

取回模型假定模型的 `read`/`grep` 工具可以检查返回的路径，即使 spill 目录在会话工作目录之外。未来的工作区隔离策略必须显式允许本地 spill 路径，或者改用非文件 spill 后端。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config`、`LocalSpillStore` 服务、清理生命周期、定位信息与取回提示的组装 |
| [`src/cleanup.ts`](src/cleanup.ts) | 一次性按年龄扫描、文件系统身份检查、符号链接和所有权保护 |
| [`src/store.ts`](src/store.ts) | 与 Cordis 无关的存储机制：私有根目录、会话目录、安全名称编码、排他写入 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。

- [spill 存储服务](../spill/README.zh.md)——此后端实现的 `saveText` 约定与词汇。
- [spill 包映射](../README.zh.md)——三包家族与各自职责。
- [dsh-spill-policy](../spill-policy/README.zh.md)——结果过大时调用此后端的策略。
- [spill 子系统](../../../docs/subsystems/spill.zh.md)——穷尽式词汇与归属。
- [工具输出 spill 决策](../../../.agents/notes/implemented/architecture/2026-07-08-tool-output-spill-files.zh.md)——能力边界与设计依据。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-spill-local'
  config:
    root: /absolute/path/to/spill
    cleanupPeriodDays: 30
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `root` | 私有 0700 临时目录 | spill 文件的根目录；设置后可将文件保存在已知位置 |
| `cleanupPeriodDays` | `30` | 文件在一次性启动清理中可被删除前需经过的天数；`0` 禁用清理 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-spill-local
