/** @vitest-environment jsdom */
/**
 * ChatRecycler stress test — verifies DOM recycling at 1000+ message scale.
 *
 * Because jsdom does not ship a native IntersectionObserver, we install a
 * shim before the ChatRecycler module is imported.  The shim collects all
 * observed targets and exposes a `flush(isIntersecting)` helper so the test
 * can simulate rows entering or leaving the viewport.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// IntersectionObserver shim (must run before ChatRecycler import)
// ---------------------------------------------------------------------------

interface ShimEntry {
  target: Element
  isIntersecting: boolean
}

let shimCallback: IntersectionObserverCallback | null = null
let shimTargets: ShimEntry[] = []

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly scrollMargin: string = ''
  readonly thresholds: readonly number[] = []

  constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    shimCallback = callback
  }

  observe(target: Element): void {
    shimTargets.push({ target, isIntersecting: false })
  }

  unobserve(target: Element): void {
    shimTargets = shimTargets.filter(e => e.target !== target)
  }

  disconnect(): void {
    shimTargets = []
    shimCallback = null
  }

  takeRecords(): IntersectionObserverEntry[] { return [] }
}

// Replace the global before ChatRecycler loads.
Object.assign(globalThis, { IntersectionObserver: MockIntersectionObserver })

/**
 * Fire the IntersectionObserver callback for every observed target with the
 * given intersection state.  This lets the test drive the recycler without a
 * real viewport.
 */
function flushIntersection(isIntersecting: boolean): void {
  if (shimCallback === null) return
  for (const s of shimTargets) s.isIntersecting = isIntersecting
  const entries = shimTargets.map(s => ({
    target: s.target,
    isIntersecting: s.isIntersecting,
    intersectionRatio: s.isIntersecting ? 1 : 0,
    intersectionRect: {} as DOMRectReadOnly,
    boundingClientRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: 0,
  })) as unknown as IntersectionObserverEntry[]
  shimCallback(entries, {} as IntersectionObserver)
}

// ---------------------------------------------------------------------------
// Imports (after the shim is installed)
// ---------------------------------------------------------------------------

import { ChatRecycler } from '../src/client/chat/ChatRecycler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attributes every chat row needs for the recycler to recognise it. */
interface RowAttrs {
  /** turn number (set via data-chat-turn) */
  turn: number
  /** flow kind (assistant, user, steering, turn-process, running) */
  kind?: string
  /** flow key (needed for scan() to observe the row) */
  flowKey?: string
}

const ROW_HEIGHT = 120 // px — rough height of a message bubble row

/**
 * Create a single chat row <div> inside `parent`, sized to ROW_HEIGHT and
 * populated with realistic inner DOM nodes.
 */
function createRow(parent: HTMLElement, attrs: RowAttrs): HTMLElement {
  const row = document.createElement('div')
  row.setAttribute('data-chat-turn', String(attrs.turn))
  row.setAttribute('data-chat-flow-kind', attrs.kind ?? 'assistant')
  row.setAttribute('data-chat-flow-key', attrs.flowKey ?? `flow-${attrs.turn}`)
  row.style.height = `${ROW_HEIGHT}px`
  // jsdom performs no layout; model the rendered height that the recycler's
  // zero-height guard reads.
  Object.defineProperty(row, 'offsetHeight', { configurable: true, get: () => ROW_HEIGHT })
  // Inner nodes simulate a message bubble: avatar, content, actions.
  const avatar = document.createElement('span')
  avatar.textContent = 'A'
  row.appendChild(avatar)
  const bubble = document.createElement('div')
  bubble.className = 'bubble'
  bubble.textContent = `Message turn ${attrs.turn}. `.repeat(8)
  row.appendChild(bubble)
  parent.appendChild(row)
  return row
}

/**
 * Build a scroll container + column with `count` chat rows and a scroller
 * that is `viewportHeight` tall.  Returns the three DOM elements plus the
 * full array of created rows.
 */
function setupFixture(
  count: number,
  viewportHeight = 600,
): { scroller: HTMLElement; column: HTMLElement; rows: HTMLElement[] } {
  const scroller = document.createElement('div')
  scroller.setAttribute('data-conversation-scroll', '')
  scroller.style.overflowY = 'auto'
  scroller.style.height = `${viewportHeight}px`
  document.body.appendChild(scroller)

  const column = document.createElement('div')
  column.className = 'column'
  scroller.appendChild(column)

  const rows: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    rows.push(createRow(column, { turn: i + 1 }))
  }
  // jsdom performs no layout; model the scroll extent as the sum of the
  // column's row heights so stability assertions read a real value.
  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    get: () => {
      let total = 0
      for (const child of column.children) total += (child as HTMLElement).offsetHeight
      return total
    },
  })
  // scroller.scrollTop at bottom so the last N rows are "in viewport".
  scroller.scrollTop = Math.max(0, ROW_HEIGHT * count - viewportHeight)
  return { scroller, column, rows }
}

/** Count how many rows are currently recycled (have the marker attribute). */
function recycledCount(rows: HTMLElement[]): number {
  return rows.filter(r => r.hasAttribute('data-chat-recycled')).length
}

/** Count the total DOM nodes inside the column (recursive). */
function domNodeCount(column: HTMLElement): number {
  let count = 0
  const walker = document.createTreeWalker(column, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode() !== null) count++
  return count
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatRecycler', () => {
  let recycler: ChatRecycler
  let scroller: HTMLElement
  let column: HTMLElement
  let rows: HTMLElement[]

  afterEach(() => {
    recycler?.disconnect()
    document.body.innerHTML = ''
    shimTargets = []
    shimCallback = null
  })

  describe('basic recycling', () => {
    beforeEach(() => {
      const fixture = setupFixture(100)
      scroller = fixture.scroller
      column = fixture.column
      rows = fixture.rows
      recycler = new ChatRecycler({ tailKeep: 5 })
      recycler.observe(scroller, column)
      // Tail protection is turn-based; production drives it from the snapshot.
      recycler.updateTurns(rows.map((_, i) => ({ turn: i + 1 })))
    })

    it('observes all rows with data-chat-flow-key', () => {
      expect(shimTargets.length).toBe(100)
    })

    it('recycles rows when they leave the viewport', () => {
      // Simulate all rows leaving the viewport.
      flushIntersection(false)
      // The last 5 rows (tailKeep) are protected from recycling.
      // user/steering kind rows are also protected, but all our rows are 'assistant'.
      const recycled = recycledCount(rows)
      expect(recycled).toBe(95) // 100 - 5 tail
    })

    it('restores rows when they re-enter the viewport', () => {
      flushIntersection(false)
      expect(recycledCount(rows)).toBe(95)
      // Bring rows back.
      flushIntersection(true)
      expect(recycledCount(rows)).toBe(0)
    })

    it('maintains scroll height after recycling', () => {
      const before = scroller.scrollHeight
      flushIntersection(false)
      const after = scroller.scrollHeight
      // Placeholder divs preserve the row height, so scrollHeight stays stable.
      expect(Math.abs(after - before)).toBeLessThan(5)
    })
  })

  describe('tail protection', () => {
    beforeEach(() => {
      const fixture = setupFixture(50)
      scroller = fixture.scroller
      column = fixture.column
      rows = fixture.rows
      recycler = new ChatRecycler({ tailKeep: 10 })
      recycler.observe(scroller, column)
    })

    it('protects the configured number of tail turns', () => {
      recycler.updateTurns(rows.map((_, i) => ({ turn: i + 1 })))
      flushIntersection(false)
      // 10 tail turns should be protected.
      expect(recycledCount(rows)).toBe(40)
    })

    it('does not recycle user-message rows', () => {
      // Change the first row to a user message.
      rows[0]!.setAttribute('data-chat-flow-kind', 'user')
      rows[1]!.setAttribute('data-chat-flow-kind', 'steering')
      recycler.updateTurns(rows.map((_, i) => ({ turn: i + 1 })))
      flushIntersection(false)
      // user and steering rows skip recycling.
      expect(rows[0]!.hasAttribute('data-chat-recycled')).toBe(false)
      expect(rows[1]!.hasAttribute('data-chat-recycled')).toBe(false)
    })
  })

  describe('restore on disconnect', () => {
    beforeEach(() => {
      const fixture = setupFixture(30)
      scroller = fixture.scroller
      column = fixture.column
      rows = fixture.rows
      recycler = new ChatRecycler({ tailKeep: 3 })
      recycler.observe(scroller, column)
      recycler.updateTurns(rows.map((_, i) => ({ turn: i + 1 })))
    })

    it('restores all rows when disconnected', () => {
      flushIntersection(false)
      expect(recycledCount(rows)).toBe(27) // 30 - 3
      recycler.disconnect()
      expect(recycledCount(rows)).toBe(0)
    })
  })

  describe('skip selectors', () => {
    beforeEach(() => {
      const fixture = setupFixture(20)
      scroller = fixture.scroller
      column = fixture.column
      rows = fixture.rows
      recycler = new ChatRecycler({ tailKeep: 0 })
      recycler.observe(scroller, column)
    })

    it('does not recycle turn-process rows', () => {
      rows[5]!.setAttribute('data-chat-flow-kind', 'turn-process')
      flushIntersection(false)
      expect(rows[5]!.hasAttribute('data-chat-recycled')).toBe(false)
      // All other rows (assistant kind) are recycled.
      expect(recycledCount(rows)).toBe(19)
    })
  })
})

// ---------------------------------------------------------------------------
// Stress: 1000+ message rows
// ---------------------------------------------------------------------------

describe('ChatRecycler stress — 1000 rows', () => {
  let recycler: ChatRecycler
  let scroller: HTMLElement
  let column: HTMLElement
  let rows: HTMLElement[]

  beforeEach(() => {
    const fixture = setupFixture(1000)
    scroller = fixture.scroller
    column = fixture.column
    rows = fixture.rows
    recycler = new ChatRecycler({ tailKeep: 5 })
    recycler.observe(scroller, column)
    recycler.updateTurns(rows.map((_, i) => ({ turn: i + 1 })))
  })

  afterEach(() => {
    recycler?.disconnect()
    document.body.innerHTML = ''
    shimTargets = []
    shimCallback = null
  })

  it('observes all 1000 rows', () => {
    expect(shimTargets.length).toBe(1000)
  })

  it('recycles 995 of 1000 rows (5 tail protected)', () => {
    flushIntersection(false)
    const recycled = recycledCount(rows)
    expect(recycled).toBe(995)
    // Verify the last 5 rows are intact.
    for (let i = 0; i < 5; i++) {
      expect(rows[995 + i]!.hasAttribute('data-chat-recycled')).toBe(false)
    }
  })

  it('reduces DOM node count significantly after recycling', () => {
    // Each row starts with ~2 child elements (avatar + bubble) + text nodes.
    // After recycling, each recycled row has just 1 placeholder div.
    const nodesBefore = domNodeCount(column)
    flushIntersection(false)
    const nodesAfter = domNodeCount(column)
    // Before: 1000 rows × 3 elements (row + avatar + bubble) = 3000 nodes.
    // After: 5 intact tail rows × 3 + 995 recycled rows × 2 (row + placeholder)
    // = 2005 nodes, a reduction of 995/3000 ≈ 33%.
    const reduction = 1 - nodesAfter / nodesBefore
    expect(reduction).toBeGreaterThan(0.3)
  })

  it('maintains scroll height within 1% after 1000-row recycle/restore', () => {
    const before = scroller.scrollHeight
    // Recycle → restore cycle.
    flushIntersection(false)
    flushIntersection(true)
    const after = scroller.scrollHeight
    const drift = Math.abs(after - before) / before
    expect(drift).toBeLessThan(0.01)
  })

  it('full recycle/restore cycle completes under 50ms', () => {
    const start = performance.now()
    flushIntersection(false)
    flushIntersection(true)
    const elapsed = performance.now() - start
    // 1000-row recycle + restore should be well under 50ms on any modern CPU.
    expect(elapsed).toBeLessThan(50)
  })
})

// ---------------------------------------------------------------------------
// Stress: 2000 message rows (extreme scale)
// ---------------------------------------------------------------------------

describe('ChatRecycler stress — 2000 rows', () => {
  let recycler: ChatRecycler

  afterEach(() => {
    recycler?.disconnect()
    document.body.innerHTML = ''
    shimTargets = []
    shimCallback = null
  })

  it('recycles 1990 of 2000 rows and stays under 100ms', () => {
    const fixture = setupFixture(2000)
    recycler = new ChatRecycler({ tailKeep: 10 })
    recycler.observe(fixture.scroller, fixture.column)
    recycler.updateTurns(fixture.rows.map((_, i) => ({ turn: i + 1 })))

    const start = performance.now()
    flushIntersection(false)
    const elapsed = performance.now() - start

    const recycled = recycledCount(fixture.rows)
    expect(recycled).toBe(1990)
    expect(elapsed).toBeLessThan(100)
  })
})
