/**
 * Native-browser acceptance for the history-loading scroll-anchoring phase contract.
 *
 * Production rule under test: ChatView.module.css disables native scroll
 * anchoring only under `[data-chat-following-tail]` (tail-following means the
 * manual follow system owns positioning), and ChatView.tsx renders that
 * attribute only after `scroll.initialized`. During history loading the manual
 * system is gated on open, so an early attribute claim disables BOTH
 * compensators: loading-phase commits that grow content above a visible row
 * shift it uncompensated. That is the Lighthouse mobile CLS 0.77 regression —
 * one scored shift, ~500px, on a turn-response block during progressive
 * session load (run#2; the one-shot run#1 never paints pre-ready growth).
 *
 * Scenarios run in real Chromium with a replica page whose anchoring rule is
 * extracted VERBATIM from the production stylesheet at test time (`:global()`
 * unwrapped), so the browser behavior is measured against the shipped selector
 * text, not a paraphrase. The replica models the progressive-load geometry:
 * the reader sits pre-scrolled mid-list, the 500px history block grows
 * entirely above the viewport top, and the text-bearing probe row is the only
 * anchor-eligible visible node. Both conditions are measured Chromium
 * preconditions for compensation — at scrollTop 0, or with the growth inside
 * the viewport, native anchoring leaves the reader uncompensated.
 *
 * Measurement note: `layout-shift` entries landing within ~500ms of the CDP
 * page setup carry `hadRecentInput` and are filtered by CLS semantics, so the
 * harness settles 750ms after `setContent` before growing the content; with
 * that settle, inner-scroller shifts score normally (measured on Chromium 156,
 * under desktop and mobile emulation, timer- and CDP-driven mutation alike).
 * The document-level control scenario proves the shift pipeline scores in the
 * same run, so the zero-shift assertions are not vacuous.
 *
 * Assertions read real `layout-shift` performance entries plus geometry:
 * - loading phase without the claim (production): native anchoring absorbs the
 *   growth in-frame — stable probe, scrollTop takes the delta, zero scored
 *   shifts;
 * - loading phase WITH the claim (pre-fix mutation control): the same growth
 *   moves the reader by the full 500px with scrollTop pinned and scores a
 *   large shift;
 * - open handoff (attribute on + manual floor pin): scrollTop writes are
 *   scrolling, not layout shifts — the handoff frame scores nothing;
 * - control: an equivalent document-level shift scores at least one entry.
 *
 * Drift guard: the `production source anchors` suite pins the TSX gating
 * expression and the CSS selector block; changing either fails this file until
 * the replica and scenarios are re-justified.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/** Page-side seams installed by the replica documents. */
declare global {
  interface Window {
    /** Insert the loading-phase growth block above the probe row. */
    __grow: () => void
    /** Claim tail-follow on the replica root section (open-handoff simulation). */
    __claimTail: () => void
    /** One-pass geometry and layout-shift snapshot for node-side assertions. */
    __read: () => PageState
    /** Sum of scored `layout-shift` values without recent input. */
    __shiftSum: number
    /** Count of scored `layout-shift` entries without recent input. */
    __shiftCount: number
  }
}

/** Observable replica state consumed by the assertions. */
interface PageState {
  /** Probe row's border-box top in viewport coordinates. */
  probeTop: number
  /** Scrollport scrollTop. */
  scrollTop: number
  /** Scrollport max scrollTop (scrollHeight − clientHeight). */
  floor: number
  /** Sum of scored `layout-shift` values without recent input. */
  shiftSum: number
  /** Count of scored `layout-shift` entries without recent input. */
  shiftCount: number
}

const CHAT_VIEW_TSX = fileURLToPath(
  new URL('../../../packages/client/ui-chat/src/client/chat/ChatView.tsx', import.meta.url),
)
const CHAT_VIEW_CSS = fileURLToPath(
  new URL('../../../packages/client/ui-chat/src/client/chat/ChatView.module.css', import.meta.url),
)

/** Lighthouse mobile class viewport; the scrollport fills it. */
const VIEWPORT = { width: 375, height: 667 }
/** Loading-phase growth inserted above the probe row. */
const GROWTH_PX = 500
/** Already-loaded history above the rows, so the growth lands above the viewport. */
const FILLER_PX = 800
/** Content below the probe, so the anchored scrollTop never clamps. */
const TAIL_PX = 2000
/** Reader position during progressive load: mid-list, growth block above the top. */
const PRE_SCROLL_TOP = 1200
/** Probe top before growth: 16px padding + filler + 4 × 80px rows − PRE_SCROLL_TOP. */
const PROBE_TOP = -64
/** scrollTop after the in-frame anchoring compensation: PRE_SCROLL_TOP + GROWTH_PX. */
const ANCHORED_SCROLL_TOP = 1700
/** Reader position after the same growth with the claim disabling anchoring. */
const UNCOMPENSATED_PROBE_TOP = 436
/** Scored-shift floor for the uncompensated case (measured ≈ 0.64). */
const UNSAFE_SHIFT_FLOOR = 0.2
/** The document-level control shift scores above this (measured ≈ 0.27). */
const CONTROL_SHIFT_FLOOR = 0.2
/**
 * Quiet period between page setup and the measured mutation: layout-shift
 * entries within ~500ms of the CDP setContent interaction carry
 * `hadRecentInput` and are filtered by CLS semantics (measured boundary:
 * a 400ms mutation scores with the flag, a 1200ms mutation scores without).
 */
const SETTLE_MS = 750

const TSX_ATTRIBUTE_GATE =
  "data-chat-following-tail={scroll.initialized && scroll.followingTail ? '' : undefined}"
const CSS_RULE_START = '.root[data-chat-following-tail] .scroll,'

/**
 * Extract the production anchoring rule verbatim, unwrapping `:global()`.
 * @returns the selector block exactly as shipped, browser-consumable.
 */
function productionAnchorRule(): string {
  const css = readFileSync(CHAT_VIEW_CSS, 'utf8')
  const start = css.indexOf(CSS_RULE_START)
  if (start < 0) throw new Error('Production overflow-anchor rule not found in ChatView.module.css')
  const end = css.indexOf('}', start)
  return css.slice(start, end + 1).replace(/:global\(([^()]*)\)/g, '$1')
}

/** Shared layout-shift observer source for both replica documents. */
const OBSERVER_JS = `
  window.__shiftSum = 0
  window.__shiftCount = 0
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue
      window.__shiftSum += entry.value
      window.__shiftCount += 1
    }
  }).observe({ type: 'layout-shift', buffered: true })`

/**
 * Build the replica document.
 * @param claimTailDuringLoad - pre-fix mutation: claim tail-follow before any landing.
 * @returns the full page HTML with observer, growth, and read seams.
 */
function replicaHtml(claimTailDuringLoad: boolean): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<style>
  html, body { margin: 0; height: 100%; }
  #scrollBody { height: 100vh; overflow-y: auto; overscroll-behavior-y: contain; }
  .root { position: relative; display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
  .scroll { flex: 1 1 auto; min-height: 0; padding: 16px; }
  ${productionAnchorRule()}
  .column { max-width: 343px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; }
  .row { height: 80px; box-sizing: border-box; border: 1px solid #ccc; }
  #process { height: 0; }
  #probe { height: 400px; background: #dde5ff; }
</style></head>
<body>
<div id="scrollBody" data-conversation-scroll="">
  <section class="root"${claimTailDuringLoad ? ' data-chat-following-tail=""' : ''}>
    <div class="scroll">
      <div class="column" data-chat-flow="">
        <div id="filler" style="height: ${FILLER_PX}px"></div>
        <div class="row" data-chat-flow-key="t1"></div>
        <div class="row" data-chat-flow-key="t2"></div>
        <div class="row" data-chat-flow-key="t3"></div>
        <div class="row" data-chat-flow-key="t4"></div>
        <div id="turn7" data-chat-turn="7">
          <div id="process" data-chat-group-part="process"></div>
          <div id="probe" class="row" data-chat-flow-key="t7r" data-chat-group-part="response">turn 7 response</div>
        </div>
        <div id="tail" style="height: ${TAIL_PX}px"></div>
      </div>
    </div>
  </section>
</div>
<script>${OBSERVER_JS}
  window.__grow = () => {
    document.getElementById('process').style.height = '${GROWTH_PX}px'
  }
  window.__claimTail = () => {
    document.querySelector('.root').setAttribute('data-chat-following-tail', '')
  }
  window.__read = () => {
    const body = document.getElementById('scrollBody')
    return {
      probeTop: document.getElementById('probe').getBoundingClientRect().top,
      scrollTop: body.scrollTop,
      floor: body.scrollHeight - body.clientHeight,
      shiftSum: window.__shiftSum,
      shiftCount: window.__shiftCount,
    }
  }
</script>
</body></html>`
}

/**
 * Build the measurement-control document: a document-level page (no inner
 * scroll container) whose timer-driven growth moves a visible probe — the
 * configuration in which headless Chromium scores `layout-shift` entries.
 * @returns the full page HTML with observer and a scheduled 300px growth.
 */
function controlHtml(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html, body { margin: 0; }</style></head>
<body>
<div id="grower" style="height: 100px; background: #fee">loading history</div>
<div id="probe" style="height: 200px; background: #eef">turn response</div>
<script>${OBSERVER_JS}
  setTimeout(() => { document.getElementById('grower').style.height = '400px' }, ${SETTLE_MS + 450})
</script>
</body></html>`
}

let browser: Browser

beforeAll(async () => {
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser.close()
})

/**
 * Open the replica pre-scrolled to the reader position, apply the
 * loading-phase growth above the viewport, and settle paints.
 * @param claimTailDuringLoad - pre-fix mutation control flag.
 * @returns the page and its pre- and post-growth state.
 */
async function growAndMeasure(claimTailDuringLoad: boolean): Promise<{ page: Page; before: PageState; after: PageState }> {
  const page = await browser.newPage()
  await page.setViewportSize(VIEWPORT)
  await page.setContent(replicaHtml(claimTailDuringLoad), { waitUntil: 'load' })
  await page.evaluate((y) => {
    const body = document.getElementById('scrollBody')
    if (body === null) throw new Error('scroll body #scrollBody missing from the replica page')
    body.scrollTop = y
  }, PRE_SCROLL_TOP)
  // Settle past the recent-input taint window so the growth's shift entries
  // are scored clean, and let the programmatic scroll land in a quiet frame.
  await page.waitForTimeout(SETTLE_MS)
  const before = await page.evaluate(() => window.__read())
  await page.evaluate(() => { window.__grow() })
  // Two animation frames guarantee the post-mutation paint was scored.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => { requestAnimationFrame(() => { resolve() }) })
  }))
  await page.waitForTimeout(150)
  const after = await page.evaluate(() => window.__read())
  return { page, before, after }
}

describe('history-loading anchoring phase contract', () => {
  it('loading phase without the tail claim absorbs above-viewport growth natively', async () => {
    const { page, before, after } = await growAndMeasure(false)
    try {
      expect(before.scrollTop).toBe(PRE_SCROLL_TOP)
      expect(before.probeTop).toBeCloseTo(PROBE_TOP, 0)
      // Native anchoring keeps the visible probe stable and moves scrollTop instead.
      expect(after.probeTop).toBeCloseTo(PROBE_TOP, 0)
      expect(after.scrollTop).toBeCloseTo(ANCHORED_SCROLL_TOP, -1)
      expect(after.shiftCount).toBe(0)
      expect(after.shiftSum).toBeLessThan(0.02)
    } finally {
      await page.close()
    }
  })

  it('claiming tail-follow before the first landing leaves the reader uncompensated', async () => {
    const { page, before, after } = await growAndMeasure(true)
    try {
      expect(before.probeTop).toBeCloseTo(PROBE_TOP, 0)
      // Both compensators off: the reader rides the growth down with pinned
      // scrollTop, and the uncompensated frame scores a large shift.
      expect(after.probeTop).toBeCloseTo(UNCOMPENSATED_PROBE_TOP, 0)
      expect(after.scrollTop).toBe(PRE_SCROLL_TOP)
      expect(after.shiftCount).toBeGreaterThanOrEqual(1)
      expect(after.shiftSum).toBeGreaterThan(UNSAFE_SHIFT_FLOOR)
    } finally {
      await page.close()
    }
  })

  it('open handoff (attribute claim plus manual floor pin) scores no shift', async () => {
    const { page, after } = await growAndMeasure(false)
    try {
      const settled = after
      // Simulate ready: manual follow claims the attribute and pins the floor.
      await page.evaluate(() => {
        window.__claimTail()
        const body = document.getElementById('scrollBody')
        if (body === null) throw new Error('scroll body #scrollBody missing from the replica page')
        body.scrollTop = body.scrollHeight - body.clientHeight
      })
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => { requestAnimationFrame(() => { resolve() }) })
      }))
      await page.waitForTimeout(150)
      const handed = await page.evaluate(() => window.__read())
      expect(handed.scrollTop).toBe(handed.floor)
      // ScrollTop writes are scrolling, not layout shifts: nothing new scores.
      expect(handed.shiftCount).toBe(settled.shiftCount)
      expect(handed.shiftSum).toBeCloseTo(settled.shiftSum, 5)
      // Under the claim, native anchoring is disabled for the manual system.
      const anchor = await page.evaluate(() => {
        const body = document.getElementById('scrollBody')
        if (body === null) throw new Error('scroll body #scrollBody missing from the replica page')
        return getComputedStyle(body).overflowAnchor
      })
      expect(anchor).toBe('none')
    } finally {
      await page.close()
    }
  })

  it('control: a document-level shift of the same class scores layout-shift entries', async () => {
    const page = await browser.newPage()
    try {
      await page.setViewportSize(VIEWPORT)
      await page.setContent(controlHtml(), { waitUntil: 'load' })
      await page.waitForTimeout(SETTLE_MS + 450 + 1000)
      const state = await page.evaluate(() => ({ shiftSum: window.__shiftSum, shiftCount: window.__shiftCount }))
      expect(state.shiftCount).toBeGreaterThanOrEqual(1)
      expect(state.shiftSum).toBeGreaterThan(CONTROL_SHIFT_FLOOR)
    } finally {
      await page.close()
    }
  })
})

describe('production source anchors', () => {
  it('ChatView gates the tail-follow claim on the first landing', () => {
    expect(readFileSync(CHAT_VIEW_TSX, 'utf8')).toContain(TSX_ATTRIBUTE_GATE)
  })

  it('ChatView.module.css gates overflow-anchor on the tail-follow attribute', () => {
    const css = readFileSync(CHAT_VIEW_CSS, 'utf8')
    expect(css).toContain(`${CSS_RULE_START}\n:global([data-conversation-scroll]):has(.root[data-chat-following-tail]) {\n  overflow-anchor: none;\n}`)
  })

  it('replica carries the production rule verbatim', () => {
    const rule = productionAnchorRule()
    expect(rule).toBe('.root[data-chat-following-tail] .scroll,\n[data-conversation-scroll]:has(.root[data-chat-following-tail]) {\n  overflow-anchor: none;\n}')
  })
})
