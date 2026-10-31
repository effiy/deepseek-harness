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
 * iOS Safari sometimes fails to fire visualViewport events on the first
 * keyboard open.  We listen for `focusin` on editable elements and
 * schedule three re-measurements after the keyboard animation so the
 * CSS variable converges on the correct value.
 *
 * @module keyboard-inset
 */

let installed = false

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

  const measure = (): void => {
    const innerH = window.innerHeight
    const visualH = vv.height
    const vvTop = vv.offsetTop
    // Correct keyboard offset: subtract both the visualViewport shrink
    // AND its vertical shift.  On Android offsetTop = 0 → offset is the
    // keyboard height.  On iOS offsetTop > 0 → the shift already accounts
    // for the keyboard, so offset resolves to 0.
    const offset = Math.max(0, innerH - visualH - vvTop)
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

  // iOS Safari can miss the initial visualViewport events when the
  // keyboard first opens.  Schedule three re-measurements after the
  // animation settles so the CSS variable converges on the correct
  // value even if the first resize event fires before the keyboard is
  // fully open.
  //
  // Timeout handles are tracked so rapid focus-in/out cycles cancel
  // stale work — a quick tap on the input followed by an immediate
  // send should not leave old scroll requests competing with the new
  // keyboard state.
  let pendingTimers: ReturnType<typeof setTimeout>[] = []
  const clearPending = (): void => {
    for (const id of pendingTimers) clearTimeout(id)
    pendingTimers = []
  }

  document.addEventListener('focusin', (event) => {
    const target = event.target as HTMLElement | null
    if (target === null) return
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
      clearPending()
      schedule()                      // immediate rAF
      pendingTimers.push(setTimeout(schedule, 150))       // mid-animation
      pendingTimers.push(setTimeout(schedule, 400))       // post-animation settle
    }
  })

  // Mirror: when focus leaves an editable, cancel any still-pending
  // work — the keyboard is closing and the old measurements are stale.
  document.addEventListener('focusout', (event) => {
    const target = event.target as HTMLElement | null
    if (target === null) return
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
      clearPending()
    }
  })
}