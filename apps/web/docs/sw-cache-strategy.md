# DSH Web Service Worker 离线缓存策略

> 版本：v1.0 | 维护：DSH·离线缓存·水豚 | 最后更新：2026-11-06

## 概述

DSH Web 客户端通过 Service Worker 实现三层离线缓存策略，在移动网络不稳定的场景下保证核心功能可用。SW 随 Vite 生产构建自动生成，无需手动干预。

## 架构总览

```
┌─────────────────────────────────────────────┐
│                  Fetch Event                  │
├──────────┬──────────┬────────────────────────┤
│ Navigate │  Static  │    API / Other         │
│ (HTML)   │ (Assets) │    (JSON, SSE…)        │
├──────────┼──────────┼────────────────────────┤
│ Network  │  Cache   │    Network             │
│  First   │  First   │     Only               │
│    ↓     │    ↓     │      ↓                 │
│  Cache   │  (bg     │    (app handles        │
│ Fallback │  reval)  │     failures)          │
└──────────┴──────────┴────────────────────────┘
```

## 三层缓存策略

### 第一层：Shell 预缓存（Install）

SW 在 install 事件中预缓存应用壳资源：

- `index.html` — 入口页面
- `assets/index-[hash].js` — 主入口 chunk
- `assets/vendor-[hash].js` — 依赖 chunk（React、KaTeX、Shiki 等）
- `assets/index-[hash].css` / `assets/vendor-[hash].css` — 样式

**构建时注入**：Vite 插件 `generateServiceWorker()` 在 `generateBundle` 阶段遍历 rollup bundle，自动收集入口 chunk 和关联 CSS，写入 `__SHELL_ASSETS__`。

**容错**：单个资源加载失败不会阻塞 install——`catch` 后继续。

### 第二层：Static Cache-First（Fetch）

匹配 `/assets/*` 路径或静态文件扩展名（svg/png/jpg/webp/woff2/webmanifest/ico）的请求：

1. **命中** → 立即返回缓存，同时后台 fetch 更新（background revalidation），下次访问生效
2. **未命中** → 从网络获取，成功后写入缓存
3. **网络失败 + 缓存未命中** → 返回 503

**缓存键**：Request URL（Vite 的 hash 文件名天然做版本控制）。

### 第三层：API Network-First（Fetch）

所有非导航、非静态的 GET 请求（API JSON、SSE 流等）直接走网络，不缓存。应用层（容错猎犬的 fetch 重试 + 离线消息队列）负责处理失败。

### Navigation：Network-First + Cache Fallback

导航请求先尝试网络：成功返回且内容为 text/html 时更新缓存；失败时回退到缓存的 index.html；缓存也没有则返回内联离线降级页。

## 缓存命中率统计

SW 内维护每层计数器：

| 指标 | 含义 |
|------|------|
| `shellHits` | Shell 预缓存命中（导航回落也算） |
| `staticHits` | Static cache-first 命中 |
| `staticMisses` | Static 初次请求（后续可命中） |
| `navFallbacks` | 导航回落到缓存/离线页 |
| `errors` | 完全未命中的失败请求 |
| `hitRate` | `(shellHits + staticHits) / total × 100%` |

客户端通过 `getSWCacheStats()` 查询（MessageChannel，2s 超时）：

```ts
import { getSWCacheStats } from './main'
const stats = await getSWCacheStats()
// => { shellHits: 42, staticHits: 315, hitRate: "89.5", uptime: 12345678, … }
```

## SW 版本更新

1. 浏览器检测到 `sw.js` 变化 → `updatefound` 事件
2. 新 SW 安装完成 → 触发 `dsh-sw-update` 自定义事件
3. `skipWaiting()` + `clients.claim()` → 新 SW 立即接管
4. UI 层监听 `dsh-sw-update` / `dsh-sw-activated` → 显示刷新提示

旧缓存（不同 `CACHE_NAME` 的版本）在 activate 事件中自动清理。

## 离线降级页

断网时显示内联 HTML 页面（不依赖任何外部资源），功能：

- 告诉用户当前离线
- 显示"Try Again"按钮（手动刷新）
- 自动轮询重连（每秒 HEAD 请求，最多 5 分钟）
- 重连成功后等待 800ms 自动刷新
- 支持亮色/暗色模式（`prefers-color-scheme`）

## PWA 配置

`public/manifest.webmanifest`：

```json
{
  "display": "standalone",
  "theme_color": "#171717",
  "background_color": "#f5f5f5",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "purpose": "any maskable" },
    { "src": "icon-512.png", "sizes": "512x512", "purpose": "any maskable" },
    { "src": "favicon.svg",  "sizes": "any",      "purpose": "any" }
  ]
}
```

## 资源预加载

`index.html` 中的预加载策略：

| 技术 | 对象 | 位置 |
|------|------|------|
| `dns-prefetch` | `api.deepseek.com` | `<head>` 早期 |
| `preconnect` | `https://api.deepseek.com` | `<head>` 早期 |
| `modulepreload` | entry chunks | Vite 构建时自动注入 |
| `font preload` | Montserrat woff2 | Vite 插件 `injectPreloadHints()` |

## 构建产物

生产构建输出：

```
dist/
├── index.html              # 入口页面
├── sw.js                   # Service Worker（含缓存版本号 + shell 清单）
├── manifest.webmanifest    # PWA manifest
├── favicon.svg / favicon-dark.svg
├── icon-192.png / icon-512.png
├── assets/
│   ├── index-[hash].js     # 主入口 chunk
│   ├── vendor-[hash].js    # 依赖 chunk
│   ├── index-[hash].css    # 主样式
│   ├── langs/*.js          # 按需语法高亮
│   └── fonts/*.woff2       # KaTeX 数学字体
└── preview/                # Worker preview surface
```

所有文本资源生成 `.br`（Brotli）+ `.gz`（Gzip）预压缩副本。

## 移动端优化要点

- **viewport**：`maximum-scale=1.0, user-scalable=no, viewport-fit=cover` — 禁止缩放
- **theme-color**：亮/暗模式双值
- **apple-mobile-web-app**：全屏 + 半透明状态栏
- **SW scope**：`/` — 覆盖所有同源请求
- **Brotli 预压缩**：压缩后体积更小，移动网络下加载更快

## 性能基线

| 指标 | 目标 | 说明 |
|------|------|------|
| Shell 缓存命中率 | 100% | Shell 资源全预缓存 |
| Static 缓存命中率 | >85% | hash 文件名，命中 = 零网络请求 |
| 离线可用 | ✅ | 无网时显示降级页，不会白屏 |
| SW 注册 | 不阻塞首屏 | `load` 事件后注册 |
| 首次安装体积 | ~3MB | index + vendor chunk + CSS |
| 更新流量 | ~50KB | 仅 index chunk 变化时 |

## 实测验证（2026-11-06）

验证脚本：`tests/sw-offline-verify.mjs`（Playwright headless Chrome，375×812 视口，静态服务器 serve `dist/`）。

| 验证项 | 实测结果 |
|--------|---------|
| SW registration | `state: "activated"`，controller 非空 |
| Shell 预缓存条目 | 6 条（`/`、`/index.html`、index/vendor 的 JS+CSS） |
| 断网刷新（有缓存） | 缓存 shell 正常渲染（`#root` 存在），非浏览器错误页 |
| 空缓存 + 断网 | OFFLINE_HTML："No Connection" + Try Again + 自动重连轮询 |
| `getSWCacheStats()` | 二次访问 `staticHits: 4, staticMisses: 0, hitRate: "100.0%"` |
| 断网导航回退 | `shellHits: 1` 正确递增 |
| 版本更新 | rebuild → 新 cache name，旧缓存 activate 时自动清理 |

## 故障恢复

1. **SW 注册失败** → 静默降级，应用正常工作（无离线缓存）
2. **SW 文件 404** → 注册失败，下次访问重试
3. **缓存满** → 浏览器 LRU 自动淘汰
4. **存储配额不足** → `cache.addAll` 部分失败，不阻塞 install
5. **SW 异常终止** → 浏览器自动重启 SW

## 文件清单

| 文件 | 作用 |
|------|------|
| `src/sw-template.js` | SW 源码模板（含统计 + 离线页） |
| `src/main.ts` | SW 注册 + 更新检测 + 统计查询 |
| `public/manifest.webmanifest` | PWA manifest |
| `public/icon-192.png` `icon-512.png` | PWA 图标 |
| `public/favicon.svg` `favicon-dark.svg` | Favicon |
| `index.html` | 入口 HTML（preload hints + meta） |
| `vite.config.ts` | `generateServiceWorker()` + `injectPreloadHints()` |