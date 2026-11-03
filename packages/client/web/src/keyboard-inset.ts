/**
 * Track the soft-keyboard height through the Visual Viewport API and publish
 * it as the `--dsh-keyboard-height` CSS custom property on
 * `document.documentElement` so sticky-bottom elements can offset themselves
 * above the virtual keyboard.
 *
 * The correct keyboard-offset formula is:
 *   `max(0, innerHeight − visualViewport.height − visualViewport.offsetTop)`
 *
 * - **Android Chrome**: visualViewport shrinks, offsetTop stays 0.
 *   The keyboard covers the bottom of the layout viewport.
 *   `innerH − visualH − 0` → the sticky composer lifts by that amount.
 * - **iOS Safari** (without `interactive-widget=resizes-content`):
 *   visualViewport shrinks AND shifts up (offsetTop > 0).  The shift
 *   already accounts for the keyboard → offset evaluates to 0 and the
 *   composer stays at the layout bottom, which maps naturally to just
 *   above the keyboard in the visual coordinate space.
 * - **iOS Safari** (with `interactive-widget=resizes-content`, 16+):
 *   the layout viewport itself shrinks → innerH ≈ visualH, offsetTop = 0,
 *   offset ≈ 0.  The sticky composer naturally rides the resized viewport.
 *
 * The older `Math.max(innerH − visualH, offsetTop)` formula was incorrect
 * on iOS: when the viewport shifts up BOTH differences equal the keyboard
 * height, and taking the max produces a **double offset** — the composer
 * jumps further up than it should.
 *
 * ## Robustness improvements (2026-11)
 *
 * - **Adaptive retry**: replaces the 3 hardcoded setTimeout intervals with
 *   an rAF-based retry loop that stops when the measured value stabilises
 *   (≤1px change between successive samples), up to 8 attempts.
 * - **ResizeObserver fallback**: observes `document.documentElement` as a
 *   secondary signal — some iOS keyboard animations resize the layout
 *   viewport without firing visualViewport events.
 * - **Focusout reset**: when the user dismisses the keyboard, a delayed
 *   measurement clears the stored height so the composer returns to its
 *   resting position without waiting for the next visualViewport event.
 *
 * @module keyboard-inset
 */

let installed = false
let vvCleanup: (() => void) | null = null

/**
 * One-shot install of the keyboard-height observer.  Safe to call more than
 * once – subsequent calls are ignored.
 */
export function installKeyboardInset(): void {
  if (installed) return
  installed = true

  if (typeof window === 'undefined') return

  const vv = window.visualViewport
  if (vv === null || vv === undefined) return

  let raf: number | null = null
  const root = document.documentElement
  let lastOffset = -1

  // Initialise both custom properties so consumers never read undefined.
  root.style.setProperty('--dsh-keyboard-height', '0px')
  root.style.setProperty('--dsh-keyboard-height-prev', '0px')

  const measure = (): void => {
    const innerH = window.innerHeight
    const visualH = vv.height
    const vvTop = vv.offsetTop
    // Correct keyboard offset: subtract both the visualViewport shrink
    // AND its vertical shift.  On Android offsetTop = 0 → offset is the
    // keyboard height.  On iOS offsetTop > 0 → the shift already accounts
    // for the keyboard, so offset resolves to 0.
    const offset = Math.max(0, innerH - visualH - vvTop)
    // Skip no-op updates to avoid unnecessary style recalculations
    // and layout cycles during rapid visualViewport event sequences.
    if (offset === lastOffset) return
    // Publish the previous height as a companion variable so CSS and JS
    // consumers can compute the delta.  On the very first measurement
    // lastOffset is -1; the guard above returns early for offset === 0
    // (the common init case), and for a non-zero first measurement the
    // prev publishes the initial 0px seed.
    root.style.setProperty('--dsh-keyboard-height-prev', `${lastOffset < 0 ? 0 : lastOffset}px`)
    // ── ScrollTop compensation ──────────────────────────────────────────
    // The composer seat lifts via GPU-composited transform (no reflow).
    // When the keyboard height changes, the scrollport viewport stays
    // the same size, but the visible content below the fold shifts.
    // Adding the delta to scrollTop keeps the content that was at the
    // bottom of the viewport in the same visual position above the
    // composer.  Clamped to the valid scroll range.
    const delta = offset - (lastOffset < 0 ? 0 : lastOffset)
    if (delta !== 0) {
      const scroller = document.querySelector<HTMLElement>('[data-conversation-scroll]')
      if (scroller) {
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        scroller.scrollTop = Math.max(0, Math.min(scroller.scrollTop + delta, maxTop))
      }
    }
    lastOffset = offset
    root.style.setProperty('--dsh-keyboard-height', `${offset}px`)
  }

  const schedule = (): void => {
    if (raf !== null) return
    raf = requestAnimationFrame(() => {
      raf = null
      measure()
    })
  }

  // First measurement before the first paint.
  measure()

  vv.addEventListener('resize', schedule)
  vv.addEventListener('scroll', schedule)

  // ── ResizeObserver fallback ────────────────────────────────────────────
  // Some iOS versions resize the layout viewport during keyboard animations
  // without firing visualViewport events.  Observing the root element size
  // catches these cases as a secondary measurement trigger.
  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      schedule()
    })
    resizeObserver.observe(root)
  }

  // ── Adaptive iOS retry ─────────────────────────────────────────────────
  // iOS Safari sometimes misses the initial visualViewport events when the
  // keyboard first opens.  Instead of three hardcoded setTimeout intervals,
  // this retry loop measures repeatedly until the value stabilises (≤1px
  // change between successive samples) or the maximum attempt count is
  // reached.  Each attempt waits 50ms then measures on the next rAF,
  // covering the full ~300ms iOS keyboard animation window in 6 attempts.
  //
  // Timer handles are tracked so rapid focus-in/out cycles cancel
  // stale work — a quick tap on the input followed by an immediate
  // send should not leave old scroll requests competing with the new
  // keyboard state.
  const MAX_RETRIES = 8
  let pendingTimers: ReturnType<typeof setTimeout>[] = []
  const clearPending = (): void => {
    for (const id of pendingTimers) clearTimeout(id)
    pendingTimers = []
  }

  const adaptiveRetry = (attempt: number): void => {
    if (attempt >= MAX_RETRIES) return
    schedule()
    const prev = lastOffset
    pendingTimers.push(setTimeout(() => {
      schedule()
      // Stabilised: no meaningful change since the previous sample.
      if (Math.abs(lastOffset - prev) <= 1) return
      adaptiveRetry(attempt + 1)
    }, 50))
  }

  document.addEventListener('focusin', (event) => {
    const target = event.target as HTMLElement | null
    if (target === null) return
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
      clearPending()
      schedule()                      // immediate rAF
      adaptiveRetry(0)                // stabilise over next frames
    }
  })

  // When focus leaves an editable, cancel stale work and schedule a
  // delayed reset so the composer returns to its resting position
  // without waiting for the next visualViewport event.
  document.addEventListener('focusout', (event) => {
    const target = event.target as HTMLElement | null
    if (target === null) return
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
      clearPending()
      // Delay the reset after the keyboard dismiss animation starts.
      pendingTimers.push(setTimeout(schedule, 100))
      pendingTimers.push(setTimeout(schedule, 350))
    }
  })

  // ── Cleanup on page unload ─────────────────────────────────────────────
  const cleanup = (): void => {
    clearPending()
    vv.removeEventListener('resize', schedule)
    vv.removeEventListener('scroll', schedule)
    window.removeEventListener('beforeunload', cleanup)
    window.removeEventListener('pagehide', cleanup)
  }
  window.addEventListener('beforeunload', cleanup)
  window.addEventListener('pagehide', cleanup)
  vvCleanup = cleanup
}

/**
 * Remove all event listeners registered by `installKeyboardInset`.
 * Intended for test teardown; the page-unload handlers call this
 * automatically.
 */
export function uninstallKeyboardInset(): void {
  vvCleanup?.()
  vvCleanup = null
  installed = false
}
