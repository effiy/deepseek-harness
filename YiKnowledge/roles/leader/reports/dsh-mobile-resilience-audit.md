# DSH 移动端韧性审计报告

> 审计人：DSH·容错猎犬 · 2026-11-04
> 审计范围：`packages/client/` 客户端代码 + `apps/web/` 服务入口
> 目标：断网/弱网/超时场景韧性、ErrorBoundary 覆盖、API 重试策略、离线消息队列、崩溃恢复

---

## 一、韧性评分卡

| 维度 | 状态 | 评分 | 说明 |
|------|------|------|------|
| 🟢 连接级重连（Connection） | ✅ 已有 | A | 指数退避 + 网络感知 + 可配置 |
| 🟢 Gateway WebSocket 重连 | ✅ 已有 | A | RemoteStreamMux 自动重连 + keep-alive |
| 🟢 Service Worker 离线回退 | ✅ 已有 | B+ | 三层缓存 + 离线 HTML；API 层无离线 |
| 🟢 网络状态监听 | ✅ 已有 | B+ | online/offline + 500ms 防抖；无 UI 暴露 |
| 🟡 Slot 级 ErrorBoundary | ⚠️ 部分 | B | 仅覆盖 slot 条目，不覆盖主组件树 |
| 🔴 应用级 ErrorBoundary | ❌ 缺失 | F | 组件崩溃 → 白屏，无降级 UI |
| 🔴 RPC fetch 调用重试 | ❌ 缺失 | F | `fetch()` 失败即抛，无退避重试 |
| 🔴 离线消息队列 | ❌ 缺失 | F | 无 IndexedDB 队列，断网消息丢失 |
| 🔴 崩溃恢复 | ❌ 缺失 | F | 无会话状态 checkpoint，崩溃后丢失上下文 |

**综合评级：C+（连接层较强，数据与交互层薄弱）**

---

## 二、逐项详细审计

### 2.1 ErrorBoundary 覆盖（❌ 核心缺失）

**现状：**

| 位置 | 组件 | 覆盖范围 | 保护策略 |
|------|------|----------|----------|
| `packages/client/ui-renderer/src/client/scoped-slots.tsx:404` | `SlotErrorBoundary` | 单个 slot entry 渲染 | 崩溃时隔离该 entry，显示空 `<div>` |
| `packages/client/ui-renderer/src/client/scoped-slots.tsx:424` | `FactoryErrorBoundary` | 单个 slot factory 实例 | 崩溃时隔离该 factory，显示空 `<div>` |

**存在缺口：**

- ❌ **无根组件 ErrorBoundary**：`AppWebEntry.run()` → `mountClient()` 最终渲染的 `uiRenderer.mount(container)` 没有外层 ErrorBoundary。任何一个业务组件（sidebar、chat、conversation、settings 等）若在 slot 外部崩溃，会导致整页白屏。
- ❌ **无 Suspense + ErrorBoundary 组合**：代码分割（动态 import）失败时无错误回退。
- ⚠️ **SlotErrorBoundary 降级 UI 过于简陋**：渲染 `<div data-slot-error={...} />`，用户看不到任何有用内容，仅控制台一条日志。
- ⚠️ **无崩溃上报**：所有 ErrorBoundary 仅 `console.error`，无 crash report pipeline。

**风险场景（移动端）：**
1. 弱网下某个 API 请求返回异常数据 → 组件渲染崩溃 → 白屏
2. localStorage 满导致 store 读写异常 → 白屏
3. 异步组件加载超时 → 白屏
4. 内存压力导致 JS 异常 → 白屏

---

### 2.2 API 重试策略（✅ 连接层有 / ❌ 调用层无）

#### 2.2.1 连接级重连（✅ 完善）

位置：`packages/client/connection/src/client/connection.ts` — `ConnectionController`

```
默认参数（ConnectionRecoveryConfig）:
├── backoffBaseMs: 500        ← 首次重试延迟上限
├── backoffFactor: 2           ← 指数增长因子
├── backoffMaxMs: 10_000       ← 延迟硬上限
├── generationReadyWarnMs: 3_000
└── generationReadyTimeoutMs: 15_000

重试延迟公式: delay = cap/2 + random(0, cap/2)
  attempt 1: 250 – 500ms
  attempt 2: 500 – 1,000ms
  attempt 3: 1,000 – 2,000ms
  attempt N: 5,000 – 10,000ms (cap)
```

**特性：**
- 手动 `reconnect()` 重置 attempt 计数器 → 即时重试
- 网络恢复 (`online` event) → 重置计数器 → 从 base delay 重新开始
- 离线时挂起重试 → 监听 `online` event 恢复
- 500ms 防抖防止 Wi-Fi 切换时抖动
- `ConnectionRecoveryConfig` 可通过 Host 配置或 `__DSH_CONNECTION_RECOVERY__` 全局覆盖

#### 2.2.2 Gateway WebSocket 重连（✅ 完善）

位置：`packages/api/gateway/src/client/stream-client.ts` — `RemoteStreamMuxClient`

- WebSocket 断线后自动重建（通过 Connection 层驱动）
- 逻辑流（journal/snapshot/remote stream）支持 resume cursor → 断线恢复后增量续传
- `RemoteStreamCarrierError` 标记可重试的物理层失败

#### 2.2.3 RPC 调用层（❌ 无重试）

位置：`packages/client/connection/src/client/rpc.ts:34-81` — `createWebConnectionRpc().call()`

```typescript
// 当前实现 — fetch 直接调用，无任何重试逻辑
const response = await send(route, { method: 'POST', ... })
if (!response.ok) {
  throw new Error(`transport failure for ${channel}/${endpoint}: HTTP ${response.status}`)
}
```

**缺口：**
- 任何 HTTP 错误（包括可恢复的 502/503/504/429）立即抛异常
- 网络瞬时断开导致的 `TypeError: Failed to fetch` 无重试
- 无幂等请求识别（GET 天然可重试，POST 需业务判断）
- 无请求超时控制（依赖浏览器默认）

**风险场景：**
- 移动端地铁隧道切换基站 → 短暂断网 → 所有进行中的 API 调用失败
- 后端短暂 502 → 用户看到错误，需手动刷新
- 弱网下 DNS 解析偶发失败 → 无重试即可恢复

---

### 2.3 离线消息队列（❌ 完全缺失）

**搜索范围：** 所有 `packages/client/` 下的 TS/TSX 文件

**结果：**
- `IndexedDB` 关键词：**0 代码引用**（仅存储层用 SQLite，那在 Host 侧）
- 离线队列数据结构：**不存在**
- 消息入队/出队逻辑：**不存在**

**现有相关机制：**

| 机制 | 位置 | 覆盖 |
|------|------|------|
| `dsh.conversation.{id}` localStorage | `packages/client/ui-conversation/src/client/stores.ts` | 仅保存草稿文本 |
| `draft-hub` | `packages/client/ui-conversation/` | 输入框草稿持久化 |
| `parentOffline` 占位符 | `packages/client/ui-conversation/src/client/locales.ts:405` | 仅子代理挂起提示 |

**草稿 ≠ 离线队列：**
- 草稿存在 localStorage，但断网时无法触发发送
- 恢复网络后需用户手动重新发送
- 无自动重发、无发送状态跟踪、无失败重试

**风险场景：**
1. 用户在地铁编写长消息 → 点击发送 → 网络断开 → 消息丢失
2. 弱网下发送失败 → 用户需重新输入（草稿可恢复但体验差）
3. 无法保证"消息必达"

---

### 2.4 崩溃恢复（❌ 完全缺失）

**搜索范围：** `packages/client/` 中的 `localStorage`、`sessionStorage`、crash recovery、state restore 关键字

**现状：**
- ✅ localStorage 用于 UI 状态持久化（侧边栏宽度、草稿、偏好设置等）
- ❌ 无会话级别的崩溃 checkpoint
- ❌ 无崩溃前页面路由/状态的保存
- ❌ 无崩溃后自动恢复逻辑

**现有持久化一览：**

| 数据 | 存储 | 覆盖 |
|------|------|------|
| 会话 draft 文本 | localStorage `dsh.conversation.{sid}` | 草稿 |
| 侧边栏右侧面板 | localStorage `dsh.sidebarRight.{sid}` | UI 布局 |
| 对话宽度偏好 | localStorage `dsh.conversation.contentWidth` | UI 偏好 |
| 快捷键配置 | localStorage `dsh.keybindings.v1` | 用户设置 |
| 工作区视图 | localStorage `dsh.workspace.view.v5` | UI 偏好 |
| schedule tab | localStorage `dsh.schedule.task-tab-bindings.{sid}` | UI 状态 |

**缺失的关键 checkpoint：**
- 当前活跃的 session ID
- 对话滚动位置
- 最后查看的消息 seq
- 输入框附件列表

**风险场景：**
- 移动端 OOM kill → 页面重载 → 回到首页，丢失当前对话上下文
- JS 异常导致整页崩溃 → 无恢复路径
- 用户手动刷新 → 丢失当前工作上下文

---

### 2.5 网络状态监听与 UI 提示（⚠️ 监听有 / UI 无）

#### 2.5.1 网络监听（✅ 完善）

位置：`packages/client/connection/src/client/index.ts:185-228` — `watchBrowserNetwork()`

```
流程:
  1. 读取 navigator.onLine 初始值
  2. 监听 online/offline 事件
  3. 500ms 防抖（防止 Wi-Fi 切换时抖动）
  4. 调用 controller.setNetworkAvailable()
     → 离线: 挂起重试，emitState('disconnected')
     → 恢复: 重置 attempt 计数器，立即开始重连
```

#### 2.5.2 UI 网络状态指示器（❌ 缺失）

- Connection 层内部持有网络状态（`networkAvailable`）
- 但此状态**未通过任何公开 API 暴露给 UI 层**
- `ConnectionStateSource` 只有 `connected | disconnected | connecting` 三种状态，**不区分"断网"和"Host 不可达"**
- 无全局"离线"banner / snackbar / indicator

**风险场景：**
- 用户离线但不知道 → 反复点击发送 → 看到多次错误 → 困惑
- 从隧道出来恢复网络 → 无提示告知已恢复
- "connecting" 和 "offline" 对用户看起来一样

---

### 2.6 Service Worker 离线策略（✅ 已有基础）

位置：`apps/web/src/sw-template.js`

| 层级 | 策略 | 请求类型 |
|------|------|----------|
| Shell | install 时 pre-cache（`cache.addAll`） | 入口 HTML + JS chunks |
| Static | cache-first + 后台 revalidation | `/assets/*`、图片/字体/WebP |
| API/其他 | network-only（`fetch(request)` 直通） | POST API、SSE、WebSocket |

**优点：**
- 离线 HTML 回退页支持暗黑模式（prefers-color-scheme）
- 旧版本 cache 自动清理
- 导航请求 network-first → cached-shell 降级链

**与我的职责边界：**
- SW 负责**静态资源离线**（DSH·离线缓存的领域）
- 容错猎犬负责**数据和交互层韧性**（API 重试、离线队列、ErrorBoundary、崩溃恢复）
- 两者互补：SW 让页面能加载，我让加载后的应用不丢数据、不白屏

---

## 三、实现方案

### 优先级 P0：应用级 ErrorBoundary + RPC fetch 重试

**3.1 全局 ErrorBoundary**

```
packages/client/ui-renderer/src/client/AppErrorBoundary.tsx (新建)

作用: 包裹 uiRenderer.mount() 的根组件，拦截所有未捕获异常
降级 UI: "出错了，刷新试试" + 重试按钮 + 错误详情折叠区
恢复: 点击重试 → 重新 mount 组件树
上报: console.error + 可选 crash report beacon
```

**3.2 fetch 重试中间件**

```
packages/client/connection/src/client/retry-fetch.ts (新建)

策略:
  - 重试判定: 5xx / 429 / network error → 重试; 4xx → 不重试
  - 退避: 1s / 2s / 4s (最多 3 次)
  - 幂等方法: GET → 自动重试; POST → 需调用方声明 idempotent
  - 支持 signal 取消
  - 与 Connection 的 connectionReset 事件联动 → 连接恢复时加速重试
```

### 优先级 P1：离线消息队列

**3.3 IndexedDB 消息队列**

```
packages/client/ui-conversation/src/client/offline-queue.ts (新建)

Schema:
  db: dsh-offline-messages
  store: outbox { keyPath: id, indexes: [sessionId, createdAt, status] }

流程:
  1. 发送前检查 navigator.onLine
  2. 离线 → 消息写入 IndexedDB (status: pending)
  3. 网络恢复 → online event → 批量出队发送
  4. 发送成功 → 删除记录; 失败 → 标记 retry + 退避
  5. 应用加载时 → 检查积压队列 → 自动重试

依赖:
  - idb (轻量 IndexedDB wrapper) 或原生 IndexedDB API
```

### 优先级 P2：崩溃恢复 + 网络状态 UI

**3.4 会话 checkpoint**

```
sessionStorage 写入 (crash-safe，标签页关闭自动清理):
  {
    activeSessionId: string,
    lastSeenSeq: number,
    scrollPosition: number,
    timestamp: number
  }

恢复流程:
  1. mountClient 前检查 sessionStorage
  2. 有 checkpoint 且时间 < 5min → 自动导航到该 session
  3. 导航成功后清除 checkpoint
```

**3.5 网络状态指示器**

```
通过 ConnectionHandle.state 暴露 isOffline 字段
→ 全局 Snackbar / Banner:
  - 离线: "无网络连接" (黄底)
  - 连接中: "正在重新连接..." (蓝底，带 loading)
  - 已恢复: "网络已恢复" (绿底，3s 自动消失)
```

---

## 四、实现工作量估算

| 任务 | 文件 | 工时 | 优先级 |
|------|------|------|--------|
| 全局 ErrorBoundary 组件 | `ui-renderer/src/client/AppErrorBoundary.tsx` | 2h | P0 |
| 挂载 ErrorBoundary 到根组件 | `ui-renderer/src/client/mount.tsx` | 0.5h | P0 |
| fetch 重试中间件 | `connection/src/client/retry-fetch.ts` | 3h | P0 |
| RPC call 接入重试 | `connection/src/client/rpc.ts` | 1h | P0 |
| IndexedDB 离线消息队列 | `ui-conversation/src/client/offline-queue.ts` | 4h | P1 |
| online/offline 事件集成队列 | `ui-conversation/apply.ts` | 1h | P1 |
| 崩溃 checkpoint | `web/src/crash-recovery.ts` | 2h | P2 |
| 网络状态 UI 指示器 | `ui-layout/src/client/NetworkStatusBanner.tsx` | 1.5h | P2 |
| **合计** | | **15h** | |

---

## 五、附录：文件索引

| 文件 | 作用 |
|------|------|
| `packages/client/connection/src/client/connection.ts` | `ConnectionController` — 指数退避重连循环 |
| `packages/client/connection/src/client/index.ts` | `watchBrowserNetwork()` — 网络状态监听 + `installConnection()` |
| `packages/client/connection/src/client/rpc.ts` | `createWebConnectionRpc()` — RPC 调用（**无重试**） |
| `packages/client/connection/src/recovery-config.ts` | `ConnectionRecoveryConfig` — 重连参数 Schema |
| `packages/api/gateway/src/client/stream-client.ts` | `RemoteStreamMuxClient` — WebSocket 复用 + 重连 |
| `packages/api/gateway/src/client/remote-stream.ts` | `RemoteStream` — 逻辑流重连 |
| `packages/api/gateway/src/client/journal-stream.ts` | Journal 流 + resume cursor |
| `packages/client/ui-renderer/src/client/scoped-slots.tsx` | `SlotErrorBoundary` + `FactoryErrorBoundary` |
| `packages/client/web/src/boot.ts` | `AppWebEntry` — 应用入口（无 ErrorBoundary） |
| `packages/client/web/src/mount.ts` | `mountClient()` — 挂载点（无 ErrorBoundary） |
| `apps/web/src/sw-template.js` | Service Worker 三层缓存 + 离线 HTML |
| `apps/web/src/main.ts` | 浏览器入口 — SW 注册 |