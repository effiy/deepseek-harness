---
title: "@deepseek-ai/dsh-session-turn-outline"
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

本包为历史记录客户端提供涵盖完整会话的轮次大纲，其中包含每个已开始轮次的有界提示词预览与落定回复预览。客户端可以导航尚未加载的轮次，并从载入所选轮次所需的准确事件序号向后分页。它适用于提供会话投影的装配；在其他装配中，客户端继续使用仅覆盖已加载窗口的导航。预览排除注入的上下文与工具结果，并且回复仅在所属轮次落定后出现。

---

## ⚡ 功能

### 限制

这些限制说明大纲描述什么、单元何时缺失。它们是当前包约束。

- **wire 值随会话增长**——每次推送携带完整大纲（整值规则），CJK 字符占满预算时每轮上限约 600 字节、通常远小于此；把预览拆成按需读取推迟到数千轮量级的会话真正需要时。
- **回复只预览已落定的轮次**——它在 `turn/end` 提交，进行中的轮次（或从未记下结束边界的轮次）在边界落地前只有提示词预览。
- **没有合格文本的轮次保持 `''`**——纯图片、纯命令的轮次可导航但按轮次号标注，步骤全程不产文本的轮次没有回复预览。
- **仅在组合了投影注册表时挂载**——其他装配不提供 `turnOutline` 键，其消费方回退到仅按已加载窗口导航。

---

## 📊 指标

无，因为 turnOutline 单元把已写入日志的轮次边界折叠成面向客户端的读模型，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包从不组装或发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释大纲背后的折叠；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

该单元是对已提交会话事件的纯折叠。锚定每个条目的是 `turn/start` 而非提示词 `user/message`，因为它的 seq 就是跳转的载入目标：agent loop（智能体循环）先记 `turn/start` 再记该轮的提示词与步骤，窗口向后分页越过该 seq 即包含整轮。提示词由首条人类 `user/message` 填充，且仅当最新条目仍为空时——同一轮内后续的人类消息（steering（中途引导））保留首个预览。回复无法同样填充（`turn/end` 不带文本），所以每条带文本的 `assistant/message` 覆写状态里的草稿，`turn/end` 提交幸存者——最新的文本，与已加载导航栏 `findLast` 的语义一致。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`inject`、在挂载 fiber 上注册单元 |
| [`src/projection.ts`](src/projection.ts) | 折叠：条目追加、预览填充、wire 视图 |
| [`src/types.ts`](src/types.ts) | `turnOutline` 投影键声明与条目类型的唯一归属 |

### 折叠规则

- 不相关事件返回同一状态引用，纯草稿变化保持 `turns` 数组身份不变；注册表的两道 `Object.is` 门由此把变更流压到每轮至多三次推送。
- 未推进轮次号的 `turn/start` 被跳过，保持大纲有序；重试边界的预览随后落在既有条目上。
- wire 视图投影 `state.turns`；持久缓存的状态 schema 在 wire schema 外再包一个草稿字段。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`inject`、在挂载 fiber 上注册单元 |
| [`src/projection.ts`](src/projection.ts) | 折叠：条目追加、预览填充、wire 视图 |
| [`src/types.ts`](src/types.ts) | `turnOutline` 投影键声明与条目类型的唯一归属 |

---

## 🔗 资源

当单元约定不够用时阅读以下页面。它们从驱动单元的注册表逐步进入相邻的会话包。

- [会话投影子系统](../../../docs/subsystems/session-projection.zh.md)——驱动单元并提供快照与变更流值的注册表。
- [会话投影注册表包](../session-projection/README.zh.md)——单元注册所依据的注册表约定。
- [会话包映射](../README.zh.md)——相邻的持久化、投影、标题与遥测包。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-session'
- name: '@deepseek-ai/dsh-session-projection'
- name: '@deepseek-ai/dsh-session-turn-outline'
```

### 参数

| 字段 | 含义 |
|---|---|
| `turn` | `turn/start` 载荷里的宿主分配轮次号 |
| `seq` | 该轮 `turn/start` 事件的 seq——窗口向后分页越过此 seq 即载入整轮 |
| `prompt` | 该轮首条人类提示词的预览（文本块以空格连接、空白折叠、50 字符封顶且截断时补省略号——即导航卡片一行）；合格提示词落日志前为 `''` |
| `response` | 该轮最后一条带文本的助手消息的预览（同样的归一化、120 字符封顶——即卡片至多三行）；轮次带着助手文本结束前为 `''` |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-turn-outline
