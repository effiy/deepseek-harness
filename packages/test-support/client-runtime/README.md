---
title: "@deepseek-ai/dsh-client-test-runtime"
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

`SlotTestRuntime.create()` 让 Vitest 套件在 jsdom 中驱动生产 slot、store、带类型的 Session 与 Workspace fixture，并对局部 DOM 断言。面向插件激活、重载、重连与清理的测试，`createClientTest` 使用具名端点 Remote mock 启动 web profile 的 bundle roster，无需业务 Host。缺失服务与未打桩调用会明确失败。整机 fixture 拥有启动和销毁，局部 runtime 提供幂等销毁。通过 `devDependencies` 将本包用于客户端测试；它不是产品插件。

链接到工作区的 bundle 从实际包目录解析依赖；各 bundle 自身目录中的依赖优先于祖先目录中继承的包。

---

## ⚡ 功能

### 适用场景

当功能套件要在真实运行时下检验 slot、存储、渲染与销毁时使用本测试台——生产 `SlotRegistry`、渲染器与 provide bundle 物化都会被挂载，绝不重实现。它是客户端测试基础设施：永远不触及模型请求，功能包仅以 `devDependencies` 依赖之。

### 限制

这些限制说明本测试台如何被消费。它们是当前包约束，不是任务积压。

- **整体档不运行生成的 Remote 客户端**——`remote.<ns>` 代理转发位置参数，不经过生成的 zod 校验、wire 名映射或 scoped 身份注入；mock handler 直接接收这些参数，生成客户端仍由 built-artifact e2e 车道覆盖。
- **代理调用绕过 Gateway 客户端的 `invoke` 与 `invokeStream`**——不做 `$mount` 生命周期检查，流失败不经 `normalizeConnectionStream` 重新标记，一元拒绝由代理自己用 Gateway 客户端导出的 `carrierFailure` 与 `cancelledFailure` 折叠。`ctx.remote.$stream`、`$on`、`$host` 是真 Gateway 客户端的。
- **未声明的端点按一元调用发出**——代理从 mock 的登记学到每个端点的模式；spec 既没给脚本也没声明（`RemoteTable.streams`、`mock.stream(endpoint)`）的流端点记为 `unary` 漏配，产品代码收到的是折叠结果而不是失败的流。`remoteDefaultResponses` 声明了 roster 启动后才打开的流；无论哪种，`dispose()` 都会让测试失败。
- **本包的 client 编译程序加了 `node` 环境类型**，好让 roster 读取器使用 `node:fs`；slot 档的源码也在这些类型下编译。
- **Session、Conversation 与 Chat fixture 保持分离**——`sessionSnapshot` 只包含 Session 控制器状态，`conversationSnapshot` 包含与目标无关的 Conversation 状态，`chatSnapshot` 包含 Chat 目标状态。组装测试提供 Session 事件条目，而不是向 `SessionSnapshot` 添加 Conversation 或 Chat 字段。

---

## 📊 指标

无；本包是浏览器侧测试基础设施，不会发起任何模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释测试台的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计

测试台不复制生产逻辑：它挂载生产 `SlotRegistry`、生产渲染器与 `UiSession` 适配器。`TestSessions` 与 `TestWorkspaces` 实现功能通过 Cordis 消费的 owner 接口，每个 fixture Session 实现 `SessionFace`，`stubConfigForm` 实现 `ConfigForm`。`UiSession` 从这些控制器绑定派生标准渲染器数据源。未 stub 的 `ISession` 行为会携缺失方法名失败。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `SlotTestRuntime` 组装、`TestRoot`、自动 frame、`mount`/`dispose` |
| [`src/sessions.ts`](src/sessions.ts) + [`src/workspaces.ts`](src/workspaces.ts) | `ISessions`/`IWorkspaces` 测试替身与 `FixtureSession` 行为桩 |
| [`src/fixtures.ts`](src/fixtures.ts) | 普通 fixture 构造器：会话快照、workspace 列表状态 |
| [`src/snapshot.ts`](src/snapshot.ts) | DOM 快照序列化器（类名哈希折叠、`<svg>` 指纹） |
| [`src/remote.ts`](src/remote.ts) | 用于 host RPC 的 `TestRemote` 替身、`RemoteError` 值转出 |
| [`src/translate.ts`](src/translate.ts) + [`src/locale-env.ts`](src/locale-env.ts) | 翻译与固定浏览器语言测试辅助 |
| [`src/config-form.ts`](src/config-form.ts) | 带测试驱动发布与写入 spy 的 `stubConfigForm` |
| [`src/assembly/roster.ts`](src/assembly/roster.ts) | `ClientRosterRow`、`ClientRoster`（`of`/`closure`/`pick`/`without`）、它所标注的 `AssemblyPlan`，以及 `graphFromRoster` |
| [`src/assembly/modules.ts`](src/assembly/modules.ts) | 源码 `/client` 导入及替换，通过生产模块 facade 的待注册工厂队列登记 |
| [`src/assembly/test-client.ts`](src/assembly/test-client.ts) | `TestClient`：绑定实例的 Connection、共享 jsdom 桩、`bootClient`、挂载、等就绪、`reload`/`unload`/`dispose` |
| [`src/assembly/vitest.ts`](src/assembly/vitest.ts) | 测试级 `mock` 与懒启动 `start` fixture |
| [`src/assembly/remote-default-responses.ts`](src/assembly/remote-default-responses.ts) | `remoteDefaultResponses`：roster 启动期 Remote 端点的默认响应 |
| [`src/assembly/remote-proxies.ts`](src/assembly/remote-proxies.ts) | 经 Connection 的无契约 `remote.<ns>` 代理：`remoteNamespacesOf`、`remoteProxiesPlugin` |
| [`src/assembly/bundle-roster.ts`](src/assembly/bundle-roster.ts) | `bundleRoster` 与 `webApp`：用 include 插件自己的 schema 与补丁应用从 bundle 补丁文件读出浏览器 roster |

### 生命周期

`create()` 构建全新上下文，挂载 slot 与会话注册表，安装渲染器，并提供 session/workspace 替身和明确失败的文件上传替身。`mount` 在启动 fiber 前对照上下文检查每个已声明注入，使缺失提供方自明报错而非永久挂起。`dispose()` 先卸载 React 树，再 dispose 功能 fiber、释放根注册、dispose 已铸 session scope 并清除持久化存储状态；每个公共修改器都包裹在 act 中，因此测试无需自行处理 SlotCore 微任务批处理或 React `act`。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `SlotTestRuntime` 组装、`TestRoot`、自动 frame、`mount`/`dispose` |
| [`src/sessions.ts`](src/sessions.ts) + [`src/workspaces.ts`](src/workspaces.ts) | `ISessions`/`IWorkspaces` 测试替身与 `FixtureSession` 行为桩 |
| [`src/fixtures.ts`](src/fixtures.ts) | 普通 fixture 构造器：会话快照、workspace 列表状态 |
| [`src/snapshot.ts`](src/snapshot.ts) | DOM 快照序列化器（类名哈希折叠、`<svg>` 指纹） |
| [`src/remote.ts`](src/remote.ts) | 用于 host RPC 的 `TestRemote` 替身、`RemoteError` 值转出 |
| [`src/translate.ts`](src/translate.ts) + [`src/locale-env.ts`](src/locale-env.ts) | 翻译与固定浏览器语言测试辅助 |
| [`src/config-form.ts`](src/config-form.ts) | 带测试驱动发布与写入 spy 的 `stubConfigForm` |
| [`src/assembly/roster.ts`](src/assembly/roster.ts) | `ClientRosterRow`、`ClientRoster`（`of`/`closure`/`pick`/`without`）、它所标注的 `AssemblyPlan`，以及 `graphFromRoster` |
| [`src/assembly/modules.ts`](src/assembly/modules.ts) | 源码 `/client` 导入及替换，通过生产模块 facade 的待注册工厂队列登记 |
| [`src/assembly/test-client.ts`](src/assembly/test-client.ts) | `TestClient`：绑定实例的 Connection、共享 jsdom 桩、`bootClient`、挂载、等就绪、`reload`/`unload`/`dispose` |
| [`src/assembly/vitest.ts`](src/assembly/vitest.ts) | 测试级 `mock` 与懒启动 `start` fixture |
| [`src/assembly/remote-default-responses.ts`](src/assembly/remote-default-responses.ts) | `remoteDefaultResponses`：roster 启动期 Remote 端点的默认响应 |
| [`src/assembly/remote-proxies.ts`](src/assembly/remote-proxies.ts) | 经 Connection 的无契约 `remote.<ns>` 代理：`remoteNamespacesOf`、`remoteProxiesPlugin` |
| [`src/assembly/bundle-roster.ts`](src/assembly/bundle-roster.ts) | `bundleRoster` 与 `webApp`：用 include 插件自己的 schema 与补丁应用从 bundle 补丁文件读出浏览器 roster |

---

## 🔗 资源

当包级约定不够用时阅读以下页面。它们从测试台逐步进入它所挂载的生产机制以及使用它的测试。

- [ui-session](../../client/ui-session/README.zh.md)——从控制器替身派生标准 Slot 数据源的生产适配器。
- [UI slots 包](../../client/ui-slots/README.zh.md)——测试台挂载的 `SlotRegistry` 约定。
- [UI renderer 包](../../client/ui-renderer/README.zh.md)——测试台安装的渲染器。
- [测试策略](../../../docs/testing.zh.md)——覆盖层级与浏览器快照流水线。
- [test-support 组地图](../README.zh.md)——兄弟 harness 与支持包。

---

## 🚀 快速开始

```ts
const runtime = await SlotTestRuntime.create()
await runtime.declare({ 'feature-slot': {} })
const handle = await runtime.mount(FeaturePlugin)
const view = runtime.renderSlot('feature-slot', { owner: props })
expect(view.container).toMatchSnapshot()
await runtime.dispose()
```

```ts
import { RemoteError } from '@deepseek-ai/dsh-client-test-runtime'

remote.goals.create.mockResolvedValue({
  ok: false,
  error: new RemoteError('goal/not-found', 'goal "g1" does not exist', { goalId: 'g1' }),
})
expect(view.getByRole('alert')).toHaveTextContent('goal/not-found')
```

局部 DOM 快照

注册的快照序列化器把 CSS-module 哈希类名折回语义名（`_frame_a1b2c3` → `frame`），使 `.snap` 文件只含结构，并把 `<svg>` 内部折叠为 `data-content` 指纹。需要自定义页面 frame 的套件改用 `root.declare(children, Frame)` 而非自动 frame；`dispose()` 沿单一轴拆除视图、功能 fiber、已铸 scope 与持久化存储状态，且幂等。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-client-runtime
