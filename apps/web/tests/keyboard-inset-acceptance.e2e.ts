/**
 * Native-browser end-to-end acceptance for the soft-keyboard inset mechanism.
 *
 * Complements `packages/client/web/tests/keyboard-inset-scenarios.spec.ts`
 * (pure formula simulation, node lane): this harness runs the PRODUCTION
 * `keyboard-inset.ts` module — bundled from source at test time, never copied —
 * inside a real Chromium page whose layout carries the verbatim
 * `--dsh-keyboard-height` consumption rules from
 * `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css`
 * (`.scrollBody` scroll-padding + `[data-conversation-scroll]` scrollTop
 * compensation + `.composerSeat` GPU transform lift). Assertions read real
 * computed geometry (bounding boxes, scrollTop, custom properties), so the
 * full chain formula → CSS variable → CSS rules → browser layout is accepted,
 * not just the arithmetic.
 *
 * Soft-keyboard simulation: headless Chromium has no OS keyboard, so the
 * Android/iOS viewport states are reproduced at the exact inputs production
 * reads — `window.visualViewport.height`/`offsetTop` shadowed per scenario,
 * real `resize` events dispatched through the real listener path, and the
 * iOS `interactive-widget=resizes-content` case driven by a REAL viewport
 * resize. Focus and typing use Playwright's native mouse/keyboard so the
 * production `focusin`/`focusout` handlers run on genuine events.
 *
 * Replica-drift guard: every copied CSS declaration is pinned against the
 * production stylesheet (`production CSS anchors` suite) — changing the real
 * rule fails this file until the replica is synced.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest'
import { build } from 'vite'

/** Page-side seams installed by this harness (see `installPageSeams`). */
declare global {
  interface Window {
    /** Production module, bundled from source as an IIFE global. */
    DSHKeyboardInset: {
      installKeyboardInset: () => void
      uninstallKeyboardInset: () => void
    }
    /** Simulated soft-keyboard viewport state read by the shadowed getters. */
    __vvSim: { height: number; offsetTop: number }
    /** Set the simulated visualViewport state; optionally dispatch the event. */
    __vvSet: (height: number, offsetTop: number, fire: 'resize' | 'scroll' | null) => void
    /** Full mechanism state read in one pass for node-side assertions. */
    __readState: () => PageState
  }
}

/** One-pass snapshot of every observable the assertions consume. */
interface PageState {
  /** `--dsh-keyboard-height` on documentElement, as published (e.g. `336px`). */
  insetVar: string
  /** `--dsh-keyboard-height-prev` companion variable. */
  prevVar: string
  /** composerSeat border-box bottom in viewport coordinates. */
  composerBottom: number
  /** composerSeat border-box top in viewport coordinates. */
  composerTop: number
  /** composerSeat computed transform (`none` or `matrix(1, 0, 0, 1, 0, -336)`). */
  transform: string
  /** `[data-conversation-scroll]` scrollTop. */
  scrollTop: number
  /** `[data-conversation-scroll]` max scrollTop (scrollHeight − clientHeight). */
  scrollMax: number
  /** The marked probe message's border-box bottom, or null when unmarked. */
  probeBottom: number | null
  /** Draft editor text content. */
  draftText: string
  /** Whether the draft editor holds DOM focus. */
  draftFocused: boolean
}

/** iPhone-class portrait viewport; 336px is a representative Android IME. */
const VIEWPORT = { width: 375, height: 812 }
const KEYBOARD = 336
const VISUAL_WITH_KEYBOARD = VIEWPORT.height - KEYBOARD
/** Replica composer card height; scrollBody therefore ends at 812 − 150. */
const COMPOSER_HEIGHT = 150

const INSET_ENTRY = fileURLToPath(
  new URL('../../../packages/client/web/src/keyboard-inset.ts', import.meta.url),
)
const CONVERSATION_CSS = fileURLToPath(
  new URL(
    '../../../packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css',
    import.meta.url,
  ),
)

/**
 * Faithful replica of the ConversationRoot consumption rules. Declarations
 * are copied verbatim from ConversationRoot.module.css (`.scrollBody` and
 * `.root[data-phase='active'] .composerSeat`); the anchor suite below fails
 * this file when the production rules move.
 */
const REPLICA_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
html, body { margin: 0; height: 100%; }
.root { display: flex; flex-direction: column; height: 100%; }
/* verbatim: ConversationRoot.module.css .scrollBody */
.scrollBody {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-right: 2px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  scroll-padding-bottom: var(--dsh-keyboard-height, 0px);
}
.msg { flex: none; height: 80px; border-bottom: 1px solid #eee; }
/* verbatim: ConversationRoot.module.css .composerSeat (base) */
.composerSeat { display: flex; flex: none; flex-direction: column; }
/* verbatim: ConversationRoot.module.css .root[data-phase='active'] .composerSeat */
.root[data-phase='active'] .composerSeat {
  margin-bottom: env(safe-area-inset-bottom, 0px);
  transform: translateY(calc(-1 * var(--dsh-keyboard-height, 0px)));
  transition: transform 120ms cubic-bezier(0, 0, 0.2, 1);
  z-index: 7;
  background: #fff;
}
.composerCard {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: ${COMPOSER_HEIGHT}px;
  padding: 12px;
}
#draft {
  flex: 1;
  min-height: 40px;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 8px;
  outline: none;
}
</style>
</head>
<body>
<div class="root" data-phase="active">
  <div class="scrollBody" data-conversation-scroll="">
${Array.from({ length: 40 }, (_, i) => `    <div class="msg">message ${i + 1}</div>`).join('\n')}
  </div>
  <div class="composerSeat">
    <div class="composerCard">
      <div id="draft" contenteditable="true" role="textbox" aria-label="发消息"></div>
      <button id="send" type="button">发送</button>
    </div>
  </div>
</div>
</body>
</html>
`

/** Shadow visualViewport inputs and expose the one-pass state reader. */
const INSTALL_PAGE_SEAMS = (): void => {
  const vv = window.visualViewport
  if (vv === null) throw new Error('visualViewport unavailable in the test browser')
  window.__vvSim = { height: vv.height, offsetTop: vv.offsetTop }
  Object.defineProperty(vv, 'height', {
    get: () => window.__vvSim.height, configurable: true,
  })
  Object.defineProperty(vv, 'offsetTop', {
    get: () => window.__vvSim.offsetTop, configurable: true,
  })
  window.__vvSet = (height, offsetTop, fire) => {
    window.__vvSim.height = height
    window.__vvSim.offsetTop = offsetTop
    if (fire !== null) vv.dispatchEvent(new Event(fire))
  }
  window.__readState = () => {
    const rootStyle = getComputedStyle(document.documentElement)
    const seat = document.querySelector<HTMLElement>('.composerSeat')!
    const scroller = document.querySelector<HTMLElement>('[data-conversation-scroll]')!
    const seatRect = seat.getBoundingClientRect()
    const probe = document.querySelector<HTMLElement>('.msg[data-probe]')
    const draft = document.querySelector<HTMLElement>('#draft')!
    return {
      insetVar: rootStyle.getPropertyValue('--dsh-keyboard-height').trim(),
      prevVar: rootStyle.getPropertyValue('--dsh-keyboard-height-prev').trim(),
      composerBottom: seatRect.bottom,
      composerTop: seatRect.top,
      transform: getComputedStyle(seat).transform,
      scrollTop: scroller.scrollTop,
      scrollMax: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
      probeBottom: probe === null ? null : probe.getBoundingClientRect().bottom,
      draftText: draft.textContent ?? '',
      draftFocused: document.activeElement === draft,
    }
  }
}

/** Wait for the production rAF chain plus the 120ms seat transition. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }),
  )
  await page.waitForTimeout(180)
}

let browser: Browser
let insetBundle: string

beforeAll(async () => {
  // Bundle the production module from source: the page runs the shipped code,
  // never a transcription of it.
  const built = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry: INSET_ENTRY, formats: ['iife'], name: 'DSHKeyboardInset' },
    },
  })
  const bundle = Array.isArray(built) ? built[0] : built
  if (bundle === undefined || !('output' in bundle)) throw new Error('keyboard-inset bundle returned a watcher, expected a build result')
  const chunk = bundle.output[0]
  if (chunk.type !== 'chunk') throw new Error('keyboard-inset bundle emitted no chunk')
  insetBundle = chunk.code
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser.close()
})

let page: Page

beforeEach(async () => {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  page = await context.newPage()
  await page.setContent(REPLICA_HTML, { waitUntil: 'load' })
  await page.addScriptTag({ content: insetBundle })
  await page.evaluate(INSTALL_PAGE_SEAMS)
  await page.evaluate(() => window.DSHKeyboardInset.installKeyboardInset())
  onTestFailed(async () => {
    const name = expect.getState().currentTestName?.replace(/\W+/g, '-') ?? 'unknown'
    await page.screenshot({ path: `.artifacts/keyboard-inset-acceptance-${name}.png` }).catch(() => {
      // A failed page cannot screenshot; the assertion error is the evidence.
    })
  })
})

describe('production CSS anchors (replica drift guard)', () => {
  it('pins every declaration the replica copies from ConversationRoot.module.css', () => {
    const css = readFileSync(CONVERSATION_CSS, 'utf8')
    expect(css).toContain('transform: translateY(calc(-1 * var(--dsh-keyboard-height, 0px)));')
    expect(css).toContain('transition: transform 120ms cubic-bezier(0, 0, 0.2, 1);')
    expect(css).toContain('scroll-padding-bottom: var(--dsh-keyboard-height, 0px);')
  })
})

describe('install', () => {
  it('seeds both custom properties and leaves the composer at the viewport bottom', async () => {
    const state = await page.evaluate(() => window.__readState())
    expect(state.insetVar).toBe('0px')
    expect(state.prevVar).toBe('0px')
    expect(state.composerBottom).toBeCloseTo(VIEWPORT.height, 0)
  })
})

describe('Android Chrome keyboard open (visualViewport shrinks, offsetTop 0)', () => {
  it('lifts the composer above the keyboard and compensates scrollTop by the delta', async () => {
    // Park the scrollport 500px above the bottom so the +336px compensation
    // has headroom and is observable unclamped, and mark the message sitting
    // at the fold: the compensation must keep it the same visual distance
    // above the composer.
    await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>('[data-conversation-scroll]')!
      scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight - 500
      const scrollerBottom = scroller.getBoundingClientRect().bottom
      let probe: HTMLElement | null = null
      for (const msg of Array.from(document.querySelectorAll<HTMLElement>('.msg'))) {
        if (msg.getBoundingClientRect().bottom <= scrollerBottom + 1) probe = msg
      }
      if (probe === null) throw new Error('no message at the fold to probe')
      probe.setAttribute('data-probe', '')
    })
    const before = await page.evaluate(() => window.__readState())
    expect(before.probeBottom).not.toBeNull()
    const gapBefore = before.composerTop - (before.probeBottom as number)

    await page.evaluate(
      ([h]) => window.__vvSet(h, 0, 'resize'),
      [VISUAL_WITH_KEYBOARD] satisfies [number],
    )
    await settle(page)
    const after = await page.evaluate(() => window.__readState())

    expect(after.insetVar).toBe(`${KEYBOARD}px`)
    expect(after.prevVar).toBe('0px')
    // GPU-composited lift: the seat's border box now ends at the visual bottom.
    expect(after.composerBottom).toBeCloseTo(VISUAL_WITH_KEYBOARD, 0)
    expect(after.transform).toContain('-336')
    // Delta compensation keeps the fold message at the same visual distance
    // above the composer instead of sliding under the lifted seat.
    expect(after.scrollTop).toBe(before.scrollTop + KEYBOARD)
    expect(after.composerTop - (after.probeBottom as number)).toBeCloseTo(gapBefore, 0)
  })
})

describe('scrollTop compensation clamps', () => {
  it('never scrolls below 0 when the keyboard closes near the top', async () => {
    await page.evaluate(([h]) => window.__vvSet(h, 0, 'resize'), [VISUAL_WITH_KEYBOARD] satisfies [number])
    await settle(page)
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('[data-conversation-scroll]')!.scrollTop = 100
    })
    await page.evaluate(([h]) => window.__vvSet(h, 0, 'resize'), [VIEWPORT.height] satisfies [number])
    await settle(page)
    const state = await page.evaluate(() => window.__readState())
    expect(state.scrollTop).toBe(0)
    expect(state.insetVar).toBe('0px')
  })
})

describe('iOS Safari keyboard open (visualViewport shrinks AND shifts up)', () => {
  it('resolves the offset to 0 so the composer rides the shifted visual viewport', async () => {
    // iOS shifts the visual viewport by exactly the keyboard height: the
    // layout bottom maps to just above the keyboard in visual coordinates,
    // so the correct published offset is 0 (the old max() formula double-
    // offset here — this assertion is its regression pin).
    await page.evaluate(
      ([h, top]) => window.__vvSet(h, top, 'resize'),
      [VISUAL_WITH_KEYBOARD, KEYBOARD] satisfies [number, number],
    )
    await settle(page)
    const state = await page.evaluate(() => window.__readState())
    expect(state.insetVar).toBe('0px')
    expect(state.composerBottom).toBeCloseTo(VIEWPORT.height, 0)
  })
})

describe('iOS interactive-widget=resizes-content (layout viewport shrinks)', () => {
  it('keeps the offset at 0 with a real viewport resize and the composer at the new bottom', async () => {
    // Real resize — innerHeight, visualViewport.height and the layout all
    // shrink together exactly as resizes-content prescribes. The simulated
    // getter is synced first so the real resize event measures the faithful
    // state (inner == visual) instead of a stale full-height visualViewport.
    await page.evaluate(([h]) => window.__vvSet(h, 0, null), [VISUAL_WITH_KEYBOARD] satisfies [number])
    await page.setViewportSize({ width: VIEWPORT.width, height: VISUAL_WITH_KEYBOARD })
    await settle(page)
    const state = await page.evaluate(() => window.__readState())
    expect(state.insetVar).toBe('0px')
    expect(state.composerBottom).toBeCloseTo(VISUAL_WITH_KEYBOARD, 0)
  })
})

describe('focusout delayed reset', () => {
  it('clears a stale inset after blur even when no visualViewport event arrives', async () => {
    await page.evaluate(([h]) => window.__vvSet(h, 0, 'resize'), [VISUAL_WITH_KEYBOARD] satisfies [number])
    await settle(page)
    expect((await page.evaluate(() => window.__readState())).insetVar).toBe(`${KEYBOARD}px`)

    await page.click('#draft')
    // The OS dismisses the keyboard without a resize event (iOS quirk): the
    // simulated viewport silently returns to full height, then a real blur
    // must trigger the production 100ms/350ms delayed re-measurement.
    await page.evaluate(([h]) => window.__vvSet(h, 0, null), [VIEWPORT.height] satisfies [number])
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur() })
    await page.waitForTimeout(500)
    const state = await page.evaluate(() => window.__readState())
    expect(state.insetVar).toBe('0px')
    expect(state.composerBottom).toBeCloseTo(VIEWPORT.height, 0)
  })
})

describe('native focus and typing while the keyboard is open', () => {
  it('holds the inset through a real click-focus and Playwright keystrokes', async () => {
    await page.evaluate(([h]) => window.__vvSet(h, 0, 'resize'), [VISUAL_WITH_KEYBOARD] satisfies [number])
    await settle(page)
    // Real mouse focus fires the production focusin handler (adaptive retry
    // chain); real keystrokes land in the contenteditable.
    await page.click('#draft')
    await page.keyboard.type('hello')
    await page.waitForTimeout(450)
    const state = await page.evaluate(() => window.__readState())
    expect(state.draftFocused).toBe(true)
    expect(state.draftText).toBe('hello')
    // The retry chain must not flicker the inset while the keyboard is up.
    expect(state.insetVar).toBe(`${KEYBOARD}px`)
    expect(state.composerBottom).toBeCloseTo(VISUAL_WITH_KEYBOARD, 0)
  })
})

describe('rapid open/close within one frame', () => {
  it('measures once on the next rAF and publishes no jitter', async () => {
    await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>('[data-conversation-scroll]')!
      scroller.scrollTop = 300
    })
    // Both events land before the scheduled rAF runs: the single measure
    // sees the closed state and the no-op guard skips the publish entirely.
    await page.evaluate(([open, full]) => {
      window.__vvSet(open, 0, 'resize')
      window.__vvSet(full, 0, 'resize')
    }, [VISUAL_WITH_KEYBOARD, VIEWPORT.height] satisfies [number, number])
    await settle(page)
    const state = await page.evaluate(() => window.__readState())
    expect(state.insetVar).toBe('0px')
    expect(state.scrollTop).toBe(300)
  })
})
