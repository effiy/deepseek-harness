/**
 * SW 离线缓存真实环境验证脚本（Playwright）
 *
 * 验证四项：
 *   ① SW registration active（controller 非空）
 *   ② Cache Storage shell 层条目数
 *   ③ 断网刷新 → 离线页/缓存 shell
 *   ④ getSWCacheStats() → 真实 hitRate
 *
 * 运行：node tests/sw-offline-verify.mjs（需先有静态服务器 serve dist/）
 */
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3099'
const results = { step1: null, step2: null, step3: null, step4: null, extras: [] }

/** Query cache stats from the SW via MessageChannel (same API as main.ts getSWCacheStats). */
async function queryStats(page) {
  return page.evaluate(() => new Promise(resolve => {
    if (!navigator.serviceWorker?.controller) { resolve(null); return }
    const channel = new MessageChannel()
    channel.port1.onmessage = e => resolve(e.data)
    channel.port1.onmessageerror = () => resolve(null)
    navigator.serviceWorker.controller.postMessage({ type: 'DSH_CACHE_STATS' }, [channel.port2])
    setTimeout(() => resolve(null), 2000)
  }))
}

/** Enumerate every Cache Storage entry grouped by cache name. */
async function enumerateCaches(page) {
  return page.evaluate(async () => {
    const out = {}
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      const keys = await cache.keys()
      out[name] = keys.map(k => new URL(k.url).pathname)
    }
    return out
  })
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
const page = await context.newPage()

try {
  // ── ① 首次加载：SW 注册 + active ──────────────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  const swState = await page.evaluate(() => {
    const reg = navigator.serviceWorker.controller
    return {
      controllerActive: reg !== null,
      scriptURL: reg?.scriptURL ?? null,
      state: reg?.state ?? null,
    }
  })
  results.step1 = swState
  console.log('① SW registration:', JSON.stringify(swState))

  // 等 install 预缓存完成（轮询 cache 直到非空，最多 10s）
  let shellCache = {}
  for (let i = 0; i < 20; i++) {
    shellCache = await enumerateCaches(page)
    const names = Object.keys(shellCache)
    if (names.length > 0 && names.some(n => (shellCache[n] ?? []).length > 0)) break
    await page.waitForTimeout(500)
  }

  // ── ② Cache Storage shell 条目 ───────────────────────────────────
  const cacheSummary = Object.fromEntries(
    Object.entries(shellCache).map(([name, entries]) => [name, { count: entries.length, entries }]),
  )
  results.step2 = cacheSummary
  console.log('② Cache Storage:', JSON.stringify(cacheSummary, null, 2))

  // ── 二次访问（在线）：让 static cache 命中，产生真实统计数据 ────────
  await page.reload({ waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(1500)

  // ── ④ getSWCacheStats()：真实 hitRate ────────────────────────────
  const stats = await queryStats(page)
  results.step4 = stats
  console.log('④ getSWCacheStats():', JSON.stringify(stats))

  // ── ③a 断网刷新：应返回缓存 shell（index.html），非浏览器错误页 ────
  await context.setOffline(true)
  await page.reload({ waitUntil: 'load', timeout: 15000 })
  const offlineShell = await page.evaluate(() => ({
    hasRoot: document.getElementById('root') !== null,
    title: document.title,
    isBrowserErrorPage: document.body?.innerText?.includes('ERR_INTERNET_DISCONNECTED') ?? false,
  }))
  results.step3 = { cachedShellOnOfflineReload: offlineShell }
  console.log('③a 断网刷新（有缓存）:', JSON.stringify(offlineShell))

  // 断网导航回退后 shellHits 应递增（验证 recordHit('shell') 语义修复）
  const offlineStats = await queryStats(page)
  results.step3.shellHitsAfterOfflineNav = offlineStats?.shellHits ?? null
  console.log('③a-post stats（shellHits 应 ≥1）:', JSON.stringify(offlineStats))

  // ── ③b 清空缓存 + 断网 + 未知路径：应显示 OFFLINE_HTML ────────────
  await page.evaluate(async () => {
    for (const name of await caches.keys()) await caches.delete(name)
  })
  await page.goto(BASE + '/uncached-path-test', { waitUntil: 'load', timeout: 15000 }).catch(() => {})
  const offlinePage = await page.evaluate(() => ({
    bodyText: document.body?.innerText?.slice(0, 200) ?? '',
    hasTryAgain: document.body?.innerHTML?.includes('Try Again') ?? false,
    title: document.title,
  }))
  results.step3.emptyCacheOfflinePage = offlinePage
  console.log('③b 空缓存断网（OFFLINE_HTML）:', JSON.stringify(offlinePage))
  await page.screenshot({ path: '/tmp/dsh-sw-offline-page.png' })

  // 断网状态下再查一次 stats（验证错误计数）
  await context.setOffline(false)
} catch (err) {
  results.error = String(err)
  console.error('VERIFY ERROR:', err)
} finally {
  await browser.close()
}

console.log('\n=== FINAL RESULTS ===')
console.log(JSON.stringify(results, null, 2))
