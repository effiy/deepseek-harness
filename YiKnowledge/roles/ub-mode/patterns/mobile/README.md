# DSH Web 移动端 UB 模式目录

> UB 模式（Unified Base Pattern）：标准化、可复用的移动端交互模式。
> 每个模式遵循三阶段方法论：审计（现状分析）→ 方案（标准化设计）→ 实现（生产落地）。

---

## 模式索引

| 模式 | 状态 | 负责人 | 一句话 |
|------|------|--------|--------|
| [断点体系](#1-断点体系-breakpoint-system) | ✅ 已实现 | DSH·响应式工 + DSH·UB实现 | 两级令牌：`--ds-bp-*`（布局级）+ `--dsh-bp-*`（组件级），标准化 760→768/1023→1024 |
| [键盘避让](#2-键盘避让-keyboard-avoidance) | ✅ 已实现 | DSH·触控交互 | overscroll + GPU compositor `translateY` + `scroll-padding` + `--dsh-keyboard-height-prev` |
| [安全区适配](#3-安全区适配-safe-area) | ✅ 已实现 | DSH·响应式工 | `base.css` `--ds-safe-*` fallback + Modal/Toast/SidebarRight 适配 |
| [触控交互](#4-触控交互-touch-interaction) | ✅ 已实现 | DSH·UB实现 | `useTouchCapability` hook → `ui-primitives` 导出 |
| [手势导航](#5-手势导航-gesture-navigation) | ⚠️ swipe-right ✅ | DSH·UB实现 | `useSwipeGesture` + SidebarEdgeZone 集成；swipe-left-to-close 留待 v2 |
| [下拉刷新](#6-下拉刷新-pull-to-refresh) | ✅ 已实现 | DSH·UB实现 | 迁移至 `ui-primitives` + TSX 组件 + `height→scaleY` compositor 优化 |
| [Service Worker](#7-service-worker-offline) | ✅ 已实现 | DSH·离线缓存 | `sw-template.js` → Vite 插件 → 三层缓存（Shell/Static/API fallback） |
| [PWA 完备性](#8-pwa-完备性-pwa-completeness) | ✅ 已实现 | DSH·离线缓存 + DSH·UB实现 | `viewport-fit=cover` + `description`/`categories` + PNG 192/512 + `display: standalone` |
| [动态视口](#9-动态视口-dynamic-viewport) | ✅ 已实现 | — | `100dvh` + Visual Viewport 回退 |
| [底部导航](#10-底部导航-bottom-navigation) | ✅ 已实现 | DSH·响应式工 | Glassmorphism + hamburger v2 + safe-area + 44px 触控区 |

状态：✅ 已实现 · ⚠️ 部分实现 · ❌ 缺失

---

## 1. 断点体系 (Breakpoint System)

### 审计
- **现状**：9 个魔法数字散落各组件，无统一断点系统。`design-platform.css` 只有颜色令牌。
- **评估**：P1 — 结构性问题，阻碍所有其他响应式改造。

### 方案
在 CSS 设计令牌层（`design-platform.css`）定义 4 个断点，在 TS 层（`columns.ts`）同步定义常量，在 layout store（`stores.ts`）发布当前断点名称。

### 实现
- **CSS 令牌**：`packages/client/ui-theme/src/styles/design-platform.css` → `--ds-bp-mobile: 640px` / `--ds-bp-tablet: 900px` / `--ds-bp-desktop: 1100px` / `--ds-bp-wide: 1400px`
- **TS 常量**：`packages/client/ui-layout/src/client/columns.ts` → `BP_MOBILE = 640` / `BP_TABLET = 900` / `BP_DESKTOP = 1100` / `BP_WIDE = 1400`
- **Store 字段**：`stores.ts` → `LayoutInfo.breakpoint: Breakpoint`，由 `setViewportWidth` 调用 `computeBreakpoint(width)` 计算
- **类型**：`type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide'`

### 使用示例
```tsx
// 组件消费断点（通过 store）
function MyComponent({ useStore }: PropsStore<ReturnType<typeof createLayoutStore>>) {
  const breakpoint = useStore(state => state.layoutInfo.breakpoint)
  if (breakpoint === 'mobile') return <MobileLayout />
  return <DesktopLayout />
}
```

```css
/* CSS 消费（仅属性值可用 var()） */
@media (max-width: 640px) {
  /* media query 不支持 var()，需硬编码 640px = --ds-bp-mobile */
  .mobile-only { display: block; }
}
```

---

## 2. 键盘避让 (Keyboard Avoidance)

### 审计
- **现状**：`packages/client/web/src/keyboard-inset.ts` 使用 Visual Viewport API，通过 `--dsh-keyboard-height` CSS 自定义属性发布键盘高度。公式正确：`max(0, innerH - visualH - vvTop)`。
- **问题**：iOS Safari 首次键盘打开不触发 visualViewport 事件，靠 3 个硬编码 setTimeout（150ms, 400ms）兜底。
- **亮点**：公式本身正确处理了 Android Chrome（offsetTop=0）和 iOS Safari（offsetTop>0）的差异。`focusout` 时清理定时器避免竞态。
- **评估**：P1 — 脆弱但不致命。需要更可靠的 iOS 键盘检测策略。

### 方案
保留当前 Visual Viewport 方案作为主路径，增加 `focusin` → `requestAnimationFrame` 链作为触发源，补充 `ResizeObserver` 观察 `document.documentElement` 作为最后的兜底。

### 实现位置
- `packages/client/web/src/keyboard-inset.ts`（现有，待加固）

### 协作
- DSH·触控交互 负责具体修复
- DSH·UB实现 负责将此模式标准化为 `useKeyboardInset` hook 文档

---

## 3. 安全区适配 (Safe Area)

### 审计
- **现状**：多处使用 `env(safe-area-inset-*)`，包括 `MobileBottomNav.module.css`。
- **问题**：缺少全局 fallback 变量。`base.css` 没有定义 `--ds-safe-top/bottom/left/right`，导致 Composer/Toast/Modal 等组件各自处理安全区，容易遗漏。
- **评估**：P1 — 全局基础设施缺失。

### 方案
在 `packages/client/web/src/base.css` 添加全局 safe-area CSS 变量：
```css
:root {
  --ds-safe-top: env(safe-area-inset-top, 0px);
  --ds-safe-bottom: env(safe-area-inset-bottom, 0px);
  --ds-safe-left: env(safe-area-inset-left, 0px);
  --ds-safe-right: env(safe-area-inset-right, 0px);
}
```

### 实现位置
- `packages/client/web/src/base.css`（需要添加）

---

## 4. 触控交互 (Touch Interaction)

### 审计
- **现状**：`@media (pointer: coarse)` 已用于 44px 最小触控区（`MobileBottomNav.module.css`）。`SidebarEdgeZone` 使用 `pointer: coarse` 过滤桌面端。
- **问题**：无统一 hook 判断触控能力。多个组件各自写 `@media (pointer: coarse)` 或 JavaScript 检测。
- **评估**：P2 — 无破坏性，但缺乏复用导致不一致。

### 方案
创建 `useTouchCapability()` hook，返回：
```ts
interface TouchCapability {
  hasCoarsePointer: boolean   // @media (pointer: coarse) 匹配
  hasFinePointer: boolean     // @media (pointer: fine) 匹配
  hasTouchScreen: boolean     // 'ontouchstart' in window
  primaryInput: 'touch' | 'mouse' | 'pen'
}
```

### 实现示例
```tsx
import { useState, useEffect } from 'react'

export function useTouchCapability(): TouchCapability {
  const [cap, setCap] = useState<TouchCapability>(() => ({
    hasCoarsePointer: matchMedia('(pointer: coarse)').matches,
    hasFinePointer: matchMedia('(pointer: fine)').matches,
    hasTouchScreen: typeof window !== 'undefined' && 'ontouchstart' in window,
    primaryInput: matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse',
  }))

  useEffect(() => {
    const mq = matchMedia('(pointer: coarse)')
    const onChange = () => setCap(prev => ({
      ...prev,
      hasCoarsePointer: mq.matches,
      primaryInput: mq.matches ? 'touch' : 'mouse',
    }))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return cap
}
```

### 实现位置
- `packages/client/ui-primitives/src/useTouchCapability.ts`（待创建）

---

## 5. 手势导航 (Gesture Navigation)

### 审计
- **现状**：`SidebarEdgeZone.tsx` 提供 16px 左侧边缘点击区（类 WeChat 风格）。仅支持点击，不支持 swipe。
- **问题**：移动端用户期望 swipe 手势打开/关闭侧栏。无手势抽象。
- **评估**：P2 — 用户体验缺口，非功能阻断。

### 方案
创建 `useSwipeGesture` hook，支持：
- 方向检测（left/right/up/down）
- 阈值配置（最小距离、最大时间）
- 回调：`onSwipeStart`, `onSwipeMove`, `onSwipeEnd`, `onSwipeCancel`
- 集成到 `SidebarEdgeZone`：右滑 → 展开侧栏

### 实现位置
- `packages/client/ui-sidebar/src/client/SidebarEdgeZone.tsx`（集成手势）
- DSH·动效实现 负责动画过渡

---

## 6. 下拉刷新 (Pull-to-Refresh)

### 审计
- **现状**：`PullToRefresh.module.css` 在 `ui-sidebar` 包，但下拉刷新应作用于对话区的滚动容器。
- **问题**：CSS 组件只有样式，无对应的 `.tsx` 逻辑组件。UI 位置错误。
- **评估**：P2 — 组件错位，需要迁移。

### 方案
1. 从 `ui-sidebar` 提取 `PullToRefresh` 的样式
2. 创建 `PullToRefresh.tsx` 逻辑组件，使用 `touchstart/touchmove/touchend` 事件
3. 注册到对话区（`ui-chat` 或 `ui-conversation`）
4. 使用 `overscroll-behavior: contain` 阻止浏览器默认橡皮筋

### 实现位置
- `packages/client/ui-chat/src/client/chat/PullToRefresh.tsx`（新组件）
- `packages/client/ui-sidebar/src/client/PullToRefresh.module.css`（迁移）

---

## 7. Service Worker (离线)

### 审计
- **现状**：`manifest.json` 存在但无 Service Worker 注册。`beforeinstallprompt` 不触发。
- **问题**：离线完全不可用。无缓存策略。PWA 安装不工作。
- **评估**：P0 — 最高优先级，功能性缺失。

### 方案
1. 创建 `sw.ts` Service Worker，缓存策略：Network First（API） + Cache First（静态资源）
2. 在 `main.ts` 注册 SW
3. 处理 `beforeinstallprompt` 事件触发安装
4. 离线降级 UI：断网提示 + 缓存内容展示

### 实现位置
- `apps/web/src/sw.ts`（待创建）
- `apps/web/src/main.ts`（注册 SW）
- DSH·离线缓存 负责实现

---

## 8. PWA 完备性 (PWA Completeness)

### 审计
- **现状**：有 `manifest.json` 和 SVG 图标。
- **问题**：缺 `viewport-fit=cover`（iOS 全屏不工作）、缺 maskable 图标、缺 `apple-mobile-web-app-capable` meta。
- **评估**：P1 — PWA 安装后体验不完整。

### 方案
1. 添加 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
2. 添加 `<meta name="apple-mobile-web-app-capable" content="yes">`
3. 添加 `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
4. 提供 maskable PNG 图标（不是仅 SVG）
5. 添加 `<link rel="apple-touch-icon">`

### 实现位置
- `apps/web/index.html`（meta 标签）
- `apps/web/public/manifest.json`（图标）
- DSH·离线缓存 负责实现

---

## 9. 动态视口 (Dynamic Viewport)

### 审计
- **现状**：已使用 `100dvh`，布局正确跟随视口变化。
- **评估**：✅ 已实现。无需改动。

### 方案
无需改动。这是一个良好的 UB 模式参考：CSS `100dvh` + Visual Viewport API 双重保障。

---

## 10. 底部导航 (Bottom Navigation)

### 审计
- **现状**：`MobileBottomNav.tsx` + `.module.css` 实现。
- **亮点**：Glassmorphism、spring 动画、safe-area 适配、44px 触控区、暗色主题。
- **评估**：✅ 已实现。UB 模式的优秀范例。

### 方案
无需改动。此组件展示了 UB 模式的最佳实践：
1. 使用设计令牌（`--ds-bp-tablet` 决定显隐）
2. 安全区适配（`env(safe-area-inset-bottom)`）
3. 触控友好（44px min-height）
4. 主题适配（`[data-ds-dark-theme]` 暗色覆盖）

---

## UB 模式三阶段检查清单

每个 UB 模式必须经过：

### 阶段 1：审计
- [ ] 现有代码位置和行数
- [ ] 魔法数字清单
- [ ] 硬编码平台假设
- [ ] 跨浏览器兼容性评估
- [ ] 性能影响评估

### 阶段 2：方案
- [ ] 标准化接口定义（TypeScript 类型）
- [ ] CSS 设计令牌（`--ds-*` 自定义属性）
- [ ] 回退策略（优雅降级）
- [ ] 协作依赖（哪些其他模式/组件依赖此模式）
- [ ] PR 拆分方案（≤200 行/PR）

### 阶段 3：实现
- [ ] 代码遵循 AGENTS.md 规则
- [ ] `pnpm run test:gui` 绿
- [ ] 类型导出遵循包导出规则
- [ ] CSS 不使用文字颜色，全部使用 `--dsw-*` 令牌
- [ ] 文案国际化（locale 字典）
- [ ] Agent Note 记录变更

---

## 变更日志

- **2026-11-04**：全量状态更新。10 个模式中 9 个已完成——键盘避让（overscroll + GPU compositor）、安全区（base.css fallback）、触控交互（useTouchCapability）、手势导航（swipe-right ✅）、下拉刷新（ui-primitives + scaleY 优化）、Service Worker（三层缓存）、PWA（viewport-fit + PNG icons）均已就位。仅剩手势导航 swipe-left-to-close 待 v2。
- **2026-11-03**：初始创建。从 UB 审计报告（`../reports/2026-11-03_dsh-mobile-ub-audit.md`）提取。断点体系已由 DSH·响应式工完成实现。