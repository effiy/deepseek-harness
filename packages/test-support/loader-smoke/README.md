---
title: "@deepseek-ai/dsh-loader-smoke"
tags: []
category: "test-support"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

使用 `dsh-loader-smoke` 可从应用 fixture（测试前置数据）的真实可执行文件及其 `cordis.yml` 启动应用，并在隔离的临时目录中捕获输出和完成清理。`runFixtureTurn` 通过已配置的根 agent 驱动一项任务，并返回最终 assistant 文本与 token 用量。测试可以选择零构建的源码执行或已构建包执行，使本地和 CI 冒烟测试分别采用对应环境预期的消费路径。这个支持层库面向测试作者，不用于产品集成。

---

## ⚡ 功能

### 限制

这些限制说明何时需要对该 harness 特别小心。它们是当前包约束，不是任务积压。

- **构建模式需要事先构建**——拥有该配置的包 manifest 还必须声明配置中点名的每个包。
- **捕获的 stdout 与 stderr 仅受 execa 默认 100 MB `maxBuffer` 约束**——失控子进程在该上限处被终止，而不是在冒烟测试自选的预算处。
- **超时只终止直接子进程**——有故障的 fixture spawn 的进程树可能比冒烟测试存活更久，需要外部清理。

---

## 📊 指标

无，因为测试 harness 仅提交调用方测试的普通用户任务，并将提示词与工具组装交由已加载的树负责。

#### KV Cache 影响

除已加载树本身的影响外，无其他影响；该 helper 既不更改请求前缀，也不跨运行保留状态。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释 harness 的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计

harness 建立在一个分离之上：冒烟测试在隔离世界中的子进程里运行，测试进程只观察与断言。`runLoaderSmoke` 创建临时 cwd（或复用调用方提供的 cwd）、在那里准备世界状态、以隔离的 DSH 主目录（该 cwd 下的 `DSH_HOME`、`DSH_AGENTS_HOME`）spawn 解析出的可执行文件、立即关闭 stdin，并在截止时间内等待干净退出，然后在每种结果下都执行检查，且只删除自己创建的 cwd。`runFixtureTurn` 留在进程内运行：它查找组合中的唯一根 agent，从持久收件箱收到任务起持续跟踪，直至整个 agent 完全停稳；随后汇总每步用量，并在返回前刷写会话。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 模式解析器、`runLoaderSmoke` 子进程 harness、选项与结果类型 |
| [`src/agent-turn.ts`](src/agent-turn.ts) | `runFixtureTurn` 直接 agent driver 与结果信封 |
| [`tests/fixtures/production-profile.ts`](tests/fixtures/production-profile.ts) | 仅限仓库内部、供集成 fixture 使用的交付 profile 组装 helper |

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 模式解析器、`runLoaderSmoke` 子进程 harness、选项与结果类型 |
| [`src/agent-turn.ts`](src/agent-turn.ts) | `runFixtureTurn` 直接 agent driver 与结果信封 |
| [`tests/fixtures/production-profile.ts`](tests/fixtures/production-profile.ts) | 仅限仓库内部、供集成 fixture 使用的交付 profile 组装 helper |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从 harness 逐步进入它启动的组合以及它所服务的 fixture。

- [llm-replay](../llm-replay/README.zh.md)——冒烟测试组合为在没有提供方密钥的情况下运行而挂载的无密钥模型 fixture。
- [Agent 包](../../core/agent/README.zh.md)——`runFixtureTurn` 驱动的根 agent。
- [测试策略](../../../docs/testing.zh.md)——无密钥快照与冒烟层级。
- [test-support 组地图](../README.zh.md)——兄弟 harness 与支持包。

---

## 🚀 快速开始

```ts
const result = await runLoaderSmoke({
  label: 'acp-agent',
  tempDirPrefix: 'acp-smoke-',
  binScript: '/abs/path/to/src/bin.ts',
  configPath: '/abs/path/to/cordis.yml',
  tsconfigPath: '/abs/path/to/tsconfig.json',
})
```

启动应用 fixture

`runLoaderSmoke` 接受可执行文件与配置路径、可选的完整可执行文件参数、环境覆盖、标准输入、运行前准备与清理前检查。它负责隔离工作目录、DSH 主目录、诊断、截止时间、终止、EOF 与清理（只清理自己创建的 cwd，调用方自带的 cwd 原样保留）；进程以零状态退出后返回两个流，失败时则拒绝并附带两个流：



源码 smoke 测试支持的 `dsh` 启动器时，设置 `sourceImport: 'tsx/esm'`；built 模式忽略此选项。当场景固定一个设计好的失败面——即一次性轮次以错误结果结束——时设置 `expectedExitCode`；以任何其他方式退出（包括成功退出）都会使冒烟测试失败。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-loader-smoke
