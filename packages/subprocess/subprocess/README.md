---
title: "@deepseek-ai/dsh-subprocess"
tags: []
category: "subprocess"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`ctx.subprocess` 可解析可执行文件、启动显式指定的子进程或真实终端会话、流式读取或有界收集输出，并终止完整的受管进程范围。每个组合配置一个 subprocess 实现，并根据命令运行位置选择本地或远程执行。每次请求都指定 argv、工作目录、stdio、环境覆盖、终止宽限期与取消信号，不会添加 shell 解释或隐藏的执行默认值。子进程环境会先移除环境中的凭据与 `DSH_*` 值，再应用显式覆盖；时限、拆卸策略与面向模型的渲染由调用方负责，收集的输出在进程退出后仍可读取。

---

## ⚡ 功能

### 限制

这些限制说明该 seam 何时不合适，或何时把工作留给消费方。它们是当前包约束，不是对比或任务积压。

- **由 SDK 管理的 spawn 仍在服务之外**——拥有内部 spawn 的传输（SDK 客户端、MCP）无法把该调用路由到本服务；它仍可导入 `scrubbedParentEnv`，使环境策略保持单一来源。
- **拆卸阶梯归消费方所有**——该 seam 只提供信号动词与受管范围等待，不提供现成的完全停稳序列；每个进程外消费方自行编码其子进程的配合方式（ACP 后端以 stdin EOF 打头的阶梯是仓库内模板）。
- **可观察性取决于提供方**——native 提供方可以通过 systemd scope 或 Windows Job 拥有逃逸后代，fallback 提供方则只暴露较弱的进程组、进程树或会话可见性。该 seam 不新增持续的进程表监视器。

---

## 📊 指标

通过消费方 seam（例如 bash 执行器家族）间接影响，它们负责进程输出与生命周期的全部面向模型渲染。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释 seam 背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中说明。

### 设计理念

本 seam 建立在一个分离之上：服务负责进程坐标与生命周期；消费方负责定义进程的含义，以及决定塑造该进程的每一项默认值。正因如此，spawn 请求完全明确——没有任何隐藏的子进程服务默认值——`SubprocessOutcome` 也只携带退出事实：时限、拆卸阶梯与原因分类归调用方所有。`dsh-shell` 的 request/spec 拆分是这条规则的所属模板。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `SubprocessRuntime`、`ctx.subprocess` 注册、共享的 `scrubbedParentEnv` 清除 |
| [`src/types.ts`](src/types.ts) | 词汇：spawn spec、stdio 模式、句柄、读取器、结果、`DSH_*` 命名空间 |

### 数据模型与流程

spawn 会立即返回活动句柄，而不公开目标身份。`done` 独立报告直接命令的结果或失败，`waitForExit()` 则报告受管范围是否完全停稳。请求的中止信号驱动与 `terminate()` 相同的终止流程。收集模式的读取器无游标：偏移量是调用方拥有的全流字节坐标，因此独立读取器不会消费彼此的输出，偏移量滑出内存尾部的读取标记为 `lossy`，并在 spill 文件存在时指向它。`spawnTerminal` 是一项底层原语，因为普通管道无法分配控制终端或清理终端会话成员。

### 生命周期与不变式

每个上下文只注册一个实现；加载第二个会抛错（Cordis 标准行为）。服务自身的 dispose（资源释放）会终止所有仍在运行的受管进程并等待其退出，因此进程生命周期在消费方重载后依然延续。`argv` 绝不经过 shell 解释；需要 shell 的消费方自行传入 `['bash', '-c', command]`。终端分配的取消（spec 信号）与已发布句柄的生命周期相互独立。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `SubprocessRuntime`、`ctx.subprocess` 注册、共享的 `scrubbedParentEnv` 清除 |
| [`src/types.ts`](src/types.ts) | 词汇：spawn spec、stdio 模式、句柄、读取器、结果、`DSH_*` 命名空间 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从穷尽式类型参考逐步进入各提供方，以及 seam 背后的决策证据。

- [子进程子系统](../../../docs/subsystems/subprocess.zh.md)——spawn spec、输出读取器、结果与完整的 `DSH_*` 环境。
- [dsh-subprocess-local](../subprocess-local/README.zh.md)——实现本约定的本地宿主提供方。
- [dsh-bash-local](../../shell/bash-local/README.zh.md)——最大的消费方：经由本服务运行 bash 命令。
- [subprocess seam Agent Note](../../../.agents/notes/archived/architecture/2026-07-26-subprocess-seam.md)——进程部分为何成为独立的 seam，以及随之迁移的内容。

-----

终端消费者通过 `terminalEnvironment()` 读取 provider 平台和首选 shell，通过 `resolveExecutable()` 验证候选。确定未找到可执行文件时抛出 `SubprocessExecutableNotFoundError`，传输故障仍单独报告。`spawnTerminal` 要求 `terminalType` 和初始尺寸，返回的 handle 通过 `resize(cols, rows)` 调整尺寸，不重新分配进程。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-subprocess-local'
- name: '@deepseek-ai/dsh-bash-local'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：抽象 `SubprocessRuntime`、`ctx.subprocess` 注册、共享的 `scrubbedParentEnv` 清除 |
| [`src/types.ts`](src/types.ts) | 词汇：spawn spec、stdio 模式、句柄、读取器、结果、`DSH_*` 命名空间 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-subprocess
