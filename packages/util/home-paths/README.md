---
title: "@deepseek-ai/dsh-home-paths"
tags: []
category: "util"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`@deepseek-ai/dsh-home-paths` 让包作者能够解析 DeepSeek Harness 数据根目录，以及其消费方读取的共享 agent 配置根目录。显式路径优先于环境变量，后者优先于操作系统主目录下的默认值；空白环境变量会被忽略。其公开辅助函数可以在不暴露机器绝对路径的情况下显示根目录，仅展开单独或当前用户的波浪号形式，并规范化最终路径段尚不存在的监听目标。请把它作为库依赖直接使用，不要通过 `cordis.yml` 加载。

---

## ⚡ 功能

### 限制

这些限制说明这些辅助函数何时不是合适的工具。它们是当前包约束，不是任务积压。

- **展开范围刻意保持狭窄**——只有单独的 `~`、`~/...` 和 `~\...` 使用当前操作系统主目录；`~alice/...` 等指定用户的形式、环境变量与 shell 表达式保持不变。
- **规范化只读不改**——`canonicalizeWatchPath` 执行 `realpath` 探测并传播除路径不存在以外的错误；调用方仍负责目录创建、权限，以及对结果路径应用信任策略。

---

## 📊 指标

「待补充」

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本包建立在一个原则上：harness 的用户数据位于同一个根目录下，而共享 agent 配置根目录保持独立，因为其他 agent 工具也会读取它。`resolveRoot` 与 `rootDisplay` 负责两个根目录的优先级与展示规则，因此两者不会彼此漂移。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 主目录解析、路径拼接、展示、波浪号展开与监听路径规范化 |

### 解析规则

`resolveDshHome` 先读显式覆盖值，然后读 `$DSH_HOME`，最后回退到操作系统主目录拼接 `.dsh`。`resolveAgentsHome` 对 `$DSH_AGENTS_HOME` 与 `~/.agents` 读取同样的三层值。选中的值经过波浪号展开并规范化为绝对路径；`dshHomePath` 用 Node 的平台路径规则拼接子路径段。`dshHomeDisplay` 与 `agentsHomeDisplay` 把解析出的路径与默认根目录比较并返回符号标签，因此已配置的根目录绝不泄露其绝对路径。

### 规范化机制

`canonicalizeWatchPath` 从目标向上逐级查找，直到找到现有祖先，用 `realpath` 解析它、证明它是可枚举目录，再拼回缺失的后缀。除路径不存在以外的错误都会传播；缺失后缀的祖先若不是目录则被拒绝。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 主目录解析、路径拼接、展示、波浪号展开与监听路径规范化 |

---

## 🔗 资源

当你需要启动器或依赖统一主目录根的消费方时，阅读以下页面。

- [boot 包](../../boot/app-boot/README.zh.md)——在任何插件挂载之前解析主目录的启动器。
- [shell 环境](../../shell/shell-env/README.zh.md)——`DSH_HOME` 如何到达模型 shell 调用。
- [匿名用户 id](../../identity/anonymous-user-id/README.zh.md)——位于解析后主目录下的存储身份文件。

-----

## 已知限制与延期工作

---

## 🚀 快速开始

```ts
import { resolveDshHome, dshHomePath, dshCachePath } from '@deepseek-ai/dsh-home-paths'

const home = resolveDshHome()                // configured path, else $DSH_HOME, else ~/.dsh
const settings = dshHomePath('settings')     // join one child onto the resolved home
const cache = dshCachePath('models')         // $DSH_HOME/cache/models, default ~/.dsh/cache/models
```

```ts
import { resolveAgentsHome, agentsHomeDisplay } from '@deepseek-ai/dsh-home-paths'

const agents = resolveAgentsHome()   // configured path, else $DSH_AGENTS_HOME, else ~/.agents
agentsHomeDisplay(agents)            // ~/.agents, or $DSH_AGENTS_HOME for any configured root
```

解析主目录



显式配置的路径优先级最高，然后是 `$DSH_HOME`，最后是默认的 `~/.dsh`。空或仅含空白的 `$DSH_HOME` 视为未设置，因此空白的覆盖值绝不会把主目录解析到当前工作目录。

`dshCachePath(...segments)` 从解析出的主目录下的 `cache` 目录派生路径。不传路径段时返回缓存目录本身。传入首个选项对象 `dshCachePath({ dshHome: home }, ...segments)` 可使用显式配置的主目录，遵循相同的优先级与波浪号展开规则。它返回绝对路径，不会创建目录。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-home-paths
