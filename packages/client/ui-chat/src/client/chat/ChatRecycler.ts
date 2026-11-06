/**
 * Content-aware DOM windowing for Chat message rows.
 *
 * On mobile devices with 200+ turns, the browser can accumulate thousands of
 * DOM nodes.  This recycler uses an IntersectionObserver to detect rows that
 * are more than 3 viewports away from the visible scroll area and replaces
 * their inner content with an equal-height placeholder `<div>`.  When a row
 * approaches the viewport, the original content is restored.
 *
 * The recycler deliberately avoids React state and re-rendering — it operates
 * directly on the live DOM.  This keeps the scroll-height stable and does not
 * interfere with the ChatViewport's scroll-anchoring, paging-preserve, or
 * flow-motion mechanisms.
 *
 * Rows that MUST NOT be recycled:
 *  - The last N loaded turns (keeps the tail fully interactive).
 *  - Any row with an active step-process (streaming content).
 *  - Any row inside a hidden ancestor (display:none rows).
 *  - User message / steering bubbles (they are already lightweight).
 *
 * @module ChatRecycler
 */

/** Selectors for rows that should never be recycled. */
const SKIP_SELECTOR = [
  '[data-chat-flow-kind="turn-process"]',  // active streaming
  '[data-step-process-content]',            // inner process content
  '[hidden] *, [hidden]',                   // hidden rows
].join(', ')

/** How many rows at the tail are excluded from recycling. */
const DEFAULT_TAIL_KEEP = 5

/** Placeholder height attribute stored on the row while recycled. */
const PLACEHOLDER_ATTR = 'data-chat-recycler-height'

/** Recycled marker attribute so the observer knows this row is already stashed. */
const RECYCLED_ATTR = 'data-chat-recycled'

/** Duration (ms) to wait after the last DOM mutation before refreshing. */
const DEBOUNCE_MS = 200

/**
 * Swap the children of a row with an equal-height placeholder `<div>`.
 * The original children are stashed in the provided WeakMap.
 */
function recycleRow(
  row: HTMLElement,
  stash: WeakMap<Element, ChildNode[]>,
): void {
  if (row.hasAttribute(RECYCLED_ATTR)) return
  const height = row.offsetHeight
  if (height === 0) return  // invisible row, no need to recycle
  const children: ChildNode[] = []
  while (row.firstChild !== null) {
    children.push(row.firstChild)
    row.removeChild(row.firstChild)
  }
  stash.set(row, children)
  const placeholder = document.createElement('div')
  placeholder.style.height = `${height}px`
  placeholder.style.contain = 'strict'
  placeholder.setAttribute('aria-hidden', 'true')
  row.setAttribute(PLACEHOLDER_ATTR, String(height))
  row.setAttribute(RECYCLED_ATTR, '')
  row.appendChild(placeholder)
}

/**
 * Restore original children from the stash and remove the placeholder.
 * @returns the border-box height the row gained (negative when it shrank);
 * React updates reach stashed children while they are detached, so the live
 * height can differ from the placeholder the eviction measured.
 */
function restoreRow(
  row: HTMLElement,
  stash: WeakMap<Element, ChildNode[]>,
): number {
  if (!row.hasAttribute(RECYCLED_ATTR)) return 0
  const before = row.offsetHeight
  const children = stash.get(row)
  // Clear the placeholder(s) — there may be multiple if the row was recycled
  // while React was in the middle of a render.
  while (row.firstChild !== null) row.removeChild(row.firstChild)
  row.removeAttribute(RECYCLED_ATTR)
  row.removeAttribute(PLACEHOLDER_ATTR)
  if (children !== undefined) {
    for (const child of children) row.appendChild(child)
    stash.delete(row)
  }
  return row.offsetHeight - before
}

/**
 * Content-aware DOM windower for Chat message rows.
 *
 * Usage:
 * ```ts
 * const recycler = new ChatRecycler({ tailKeep: 5 })
 * recycler.observe(scroller, column)
 * // … when turns change or layout settles:
 * recycler.refresh()
 * // … on unmount:
 * recycler.disconnect()
 * ```
 */
export class ChatRecycler {
  private observer: IntersectionObserver | null = null
  private stash = new WeakMap<Element, ChildNode[]>()
  private tailKeep: number
  private column: HTMLElement | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  /** Turn numbers of the last N turns — rows with these turns are never recycled. */
  private protectedTurns = new Set<number>()
  private readonly absorbAbove: ((px: number) => void) | undefined

  /**
   * @param options.tailKeep - how many tail turns stay fully interactive.
   * @param options.absorbAbove - receives the summed height that restored rows
   * added above the scrollport's top edge, once per observer delivery. The
   * IntersectionObserver callback runs after the frame's paint, so a restore
   * whose live height differs from its placeholder paints one uncompensated
   * frame unless the scroll owner shifts by the same delta in this same task.
   */
  constructor(options: { tailKeep?: number; absorbAbove?: (px: number) => void } = {}) {
    this.tailKeep = options.tailKeep ?? DEFAULT_TAIL_KEEP
    this.absorbAbove = options.absorbAbove
  }

  /**
   * Start observing the column's children for recycling opportunities.
   * @param scroller — the scroll container (used as IntersectionObserver root).
   * @param column — the element whose children are the chat rows.
   */
  observe(scroller: HTMLElement, column: HTMLElement): void {
    this.disconnect()
    this.column = column

    this.observer = new IntersectionObserver(
      (entries) => {
        let absorbed = 0
        let scrollerTop: number | null = null
        for (const entry of entries) {
          const row = entry.target as HTMLElement
          if (entry.isIntersecting) {
            // A row restored above the reader pushes the reading position down
            // by its height delta; rows below the reader move nothing visible.
            scrollerTop ??= scroller.getBoundingClientRect().top
            const above = row.getBoundingClientRect().bottom <= scrollerTop
            const delta = restoreRow(row, this.stash)
            if (above) absorbed += delta
          } else if (this.canRecycle(row)) {
            recycleRow(row, this.stash)
          }
        }
        if (absorbed !== 0) this.absorbAbove?.(absorbed)
      },
      {
        root: scroller,
        rootMargin: '200% 0px',  // 3-viewport zone
        threshold: 0,
      },
    )

    this.scan()
  }

  /** Disconnect and restore all recycled rows. */
  disconnect(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.observer !== null) {
      // Restore all stashed rows before disconnecting.  Use the attribute
      // marker because WeakMap is not iterable.
      if (this.column !== null) {
        const recycled = this.column.querySelectorAll(`[${RECYCLED_ATTR}]`)
        for (const row of recycled) {
          restoreRow(row as HTMLElement, this.stash)
        }
      }
      this.observer.disconnect()
      this.observer = null
    }
    this.column = null
    this.protectedTurns.clear()
  }

  /**
   * Update the set of rows excluded from recycling.
   * Called when turns change (new messages arrive, history loaded).
   * @param turns — ordered turn numbers from the Chat snapshot navigation.
   */
  updateTurns(turns: readonly { turn: number }[]): void {
    this.protectedTurns.clear()
    const keep = Math.min(this.tailKeep, turns.length)
    for (let i = turns.length - keep; i < turns.length; i++) {
      const t = turns[i]
      if (t !== undefined) this.protectedTurns.add(t.turn)
    }
    this.debouncedScan()
  }

  /** Re-scan all observed rows (e.g. after layout change). */
  refresh(): void {
    this.debouncedScan()
  }

  /** Update how many tail turns are excluded from recycling. */
  setTailKeep(n: number): void {
    this.tailKeep = n
  }

  // ── private ────────────────────────────────────────────────────────

  private canRecycle(row: HTMLElement): boolean {
    if (row.hasAttribute(RECYCLED_ATTR)) return false
    if (row.matches(SKIP_SELECTOR)) return false
    // Check if the row belongs to a protected turn.
    const turn = row.getAttribute('data-chat-turn')
    if (turn !== null) {
      const turnNum = Number(turn)
      if (Number.isSafeInteger(turnNum) && this.protectedTurns.has(turnNum)) return false
    }
    // Don't recycle user messages and steering rows (they are light).
    const kind = row.getAttribute('data-chat-flow-kind')
    if (kind === 'user' || kind === 'steering') return false
    // Don't recycle rows that are empty (still rendering).
    if (row.childElementCount === 0) return false
    // Don't recycle the [data-chat-turn-spacer] or running status row.
    if (row.hasAttribute('data-chat-turn-spacer')) return false
    if (row.getAttribute('data-chat-flow-kind') === 'running') return false
    return true
  }

  private scan(): void {
    const observer = this.observer
    const column = this.column
    if (observer === null || column === null) return
    // Observe direct children of the column that are chat rows.
    for (const child of column.children) {
      if (child instanceof HTMLElement && child.hasAttribute('data-chat-flow-key')) {
        observer.observe(child)
      }
    }
  }

  private debouncedScan(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.scan()
    }, DEBOUNCE_MS)
  }
}
