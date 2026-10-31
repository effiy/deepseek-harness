---
title: "@deepseek-ai/dsh-session-snapshot"
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

`dsh-session-snapshot` 提供无密钥已记录会话测试（`pnpm run test:snapshot`）背后的共享支持：封闭 manifest、类型化身份脱敏、规范化、workspace 比较、fixture（测试前置数据）保护，以及 headless、SDK、ACP（Agent Client Protocol）与 Web owner 使用的协议适配器。ACP 适配器以真实子进程启动被测 profile，驱动确定性输入脚本，并注册完整的录制、回放与刷新套件。每个场景都提交足够证据来证明模型可见输出与文件系统效果，不依赖 agent（智能体）自述。包入口会导入 vitest，因此只能在 vitest 运行中使用。

---

## ⚡ 功能

### 限制

这些限制说明何时需要对该工具包特别小心。它们是当前包约束，不是任务积压。

- **会话收集需要原始 JSONL mode**——`runScenario` 收集持久化 `.jsonl` 日志，因此快照配置使用 JSONL 后端的 `compression: 'none'`；压缩 JSONL 没有快照收集路径。
- **构建 mode 需要当前产物**——选择 `DSH_EXAMPLE_MODE=lib` 前先运行 `pnpm run build`；源 mode 仍是零构建路径。
- **ACP 继续覆盖协议行为**——刺激来自 ACP 客户端的取消与权限往返留在该适配器；组装式一次性行为与持久控制行为使用 headless 与 SDK 适配器。

---

## 📊 指标

无。该测试专用支持会记录、规范化并比较 profile 会话，不会改变 agent 组装的模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释工具包的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计

共享核心拥有 manifest、generation 限定角色选择、workspace 设置／比较、类型化身份映射、normalizer 与 fixture 不变式。ACP 适配器增加四个可组合层：launcher、场景 harness、normalizer 与 suite factory。`launchAcpTestAgent` 在 tsx 下启动源码 profile，或在普通 Node 下启动已构建 `lib` profile，通过原始字节 stdout tee 连接 SDK client，收集 Session update 与 stderr，默认拒绝未处理的权限请求，并负责关闭。`runScenario` 驱动 ACP JSON-RPC stdio，并收集每个 Session 目录中数值最高的持久原始 JSONL generation。纯 normalizer 把 cwd 路径与类型化身份变为稳定 token，将时间归零、展开物理来源区间，并擦除系统提示词文本与工具 schema bulk。`defineAcpSnapshotSuite` 注册比较、generation 限定 fixture 回写与实时一致性保护。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/launcher.ts`](src/launcher.ts) | 子进程/客户端启动器与关闭所有权 |
| [`src/harness.ts`](src/harness.ts) | 脚本化场景驱动与会话日志收集 |
| [`src/manifest.ts`](src/manifest.ts) | 封闭 `snapshot.yml` schema、收集与归属规则 |
| [`src/session-files.ts`](src/session-files.ts) | 规范 parent/child generation grammar、header 一致性与最高角色选择 |
| [`src/identity.ts`](src/identity.ts) | 跨父子日志的类型化首次出现身份 token 化 |
| [`src/normalize.ts`](src/normalize.ts) | 纯规范化器与擦除辅助 |
| [`src/workspace.ts`](src/workspace.ts) | 场景 workspace 设置与完整预期状态比较 |
| [`src/suite.ts`](src/suite.ts) | 场景表套件工厂、fixture 保护、录制/刷新回写 |
| [`src/index.ts`](src/index.ts) | 再导出四个层的包入口 |

### 数据流

场景在启动器下运行 agent，通过 harness 向它喂入输入脚本，并捕获 stdout 与持久化日志。规范化器把捕获内容规范化——id 转为首次出现序列、生成 cwd 转为 `{{cwd}}`、`system/message` 文本转为 `{{system}}`、header 工具 schema 转为 `{{tools}}`——使已录制与本次运行可以结构化比较。随后工厂把规范化 stdout 与重新持久化日志同已提交 fixture 比较，或在录制/刷新模式下回写它们；其保护在任何比较结果被采信之前就拒绝畸形或漂移的 fixture。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/launcher.ts`](src/launcher.ts) | 子进程/客户端启动器与关闭所有权 |
| [`src/harness.ts`](src/harness.ts) | 脚本化场景驱动与会话日志收集 |
| [`src/manifest.ts`](src/manifest.ts) | 封闭 `snapshot.yml` schema、收集与归属规则 |
| [`src/session-files.ts`](src/session-files.ts) | 规范 parent/child generation grammar、header 一致性与最高角色选择 |
| [`src/identity.ts`](src/identity.ts) | 跨父子日志的类型化首次出现身份 token 化 |
| [`src/normalize.ts`](src/normalize.ts) | 纯规范化器与擦除辅助 |
| [`src/workspace.ts`](src/workspace.ts) | 场景 workspace 设置与完整预期状态比较 |
| [`src/suite.ts`](src/suite.ts) | 场景表套件工厂、fixture 保护、录制/刷新回写 |
| [`src/index.ts`](src/index.ts) | 再导出四个层的包入口 |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从快照工具包逐步进入模型 fixture 来源、启动机制与要求该层级存在的策略。

- [llm-replay](../llm-replay/README.zh.md)——回放模式消费的无密钥模型 fixture 来源。
- [loader-smoke](../loader-smoke/README.zh.md)——启动器所依赖的模式感知子进程启动机制。
- [测试策略](../../../docs/testing.zh.md)——无密钥快照层、其适用时机与 fixture 归属规则。
- [test-support 组地图](../README.zh.md)——兄弟 harness 与支持包。

---

## 🚀 快速开始

```ts
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  defineAcpSnapshotSuite,
  type Scenario,
  type SnapshotSuiteOptions,
} from '@deepseek-ai/dsh-session-snapshot'

function snapshotMode(value: string | undefined): SnapshotSuiteOptions['mode'] {
  switch (value) {
    case undefined:
    case '':
    case 'replay': return 'replay'
    case 'record': return 'record'
    case 'refresh': return 'refresh'
    default: throw new Error(`unknown DSH_SNAPSHOT mode: ${value}`)
  }
}

const SCENARIOS: Scenario[] = [
  { name: 'text-turn', hasModelTurn: true, recorded: true, pinsHeader: true },
]

defineAcpSnapshotSuite({
  agent: { // absolute paths, resolved from the suite's own location
    binScript: fileURLToPath(new URL('../../../apps/cli/src/bin.ts', import.meta.url)),
    configPath: fileURLToPath(new URL('../cordis.yml', import.meta.url)),
    profile: 'acp',
    tsconfigPath: fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
  },
  snapshotsDir: join(dirname(fileURLToPath(import.meta.url)), 'snapshots'),
  scenarios: SCENARIOS, // exactly one entry per header class sets pinsHeader
  mode: snapshotMode(process.env.DSH_SNAPSHOT),
})
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-session-snapshot
