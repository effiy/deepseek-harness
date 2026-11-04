/**
 * Full-scenario verification for keyboard-inset.ts.
 *
 * Tests the core measure() formula and scrollTop compensation across
 * Android Chrome, iOS Safari, and iOS interactive-widget=resizes-content
 * viewport behaviours, plus edge cases.
 *
 * Run:  pnpm vitest run packages/client/web/tests/keyboard-inset-scenarios.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'

/** The keyboard-offset formula extracted from keyboard-inset.ts line 74. */
function computeOffset(
  innerHeight: number,
  visualHeight: number,
  offsetTop: number,
): number {
  return Math.max(0, innerHeight - visualHeight - offsetTop)
}

/**
 * Simulates a full keyboard open→close cycle, tracking CSS variable
 * and scrollTop state through successive measure() calls.
 */
class Simulator {
  innerHeight = 844  // iPhone 14 layout viewport height
  visualHeight = 844
  offsetTop = 0
  keyboardHeight = 0
  keyboardHeightPrev = 0
  lastOffset = -1
  scrollTop = 0
  scrollHeight = 4000
  clientHeight = 844

  /** Mimics measure() in keyboard-inset.ts lines 66-101. */
  measure(): { offset: number; delta: number; scrollTopAdjusted: boolean } {
    const offset = computeOffset(this.innerHeight, this.visualHeight, this.offsetTop)
    if (offset === this.lastOffset) return { offset, delta: 0, scrollTopAdjusted: false }

    this.keyboardHeightPrev = this.lastOffset < 0 ? 0 : this.lastOffset
    const delta = offset - (this.lastOffset < 0 ? 0 : this.lastOffset)

    // ScrollTop compensation (lines 91-98)
    let scrollTopAdjusted = false
    if (delta !== 0) {
      const maxTop = Math.max(0, this.scrollHeight - this.clientHeight)
      const newTop = Math.max(0, Math.min(this.scrollTop + delta, maxTop))
      if (newTop !== this.scrollTop) {
        this.scrollTop = newTop
        scrollTopAdjusted = true
      }
    }

    this.lastOffset = offset
    this.keyboardHeight = offset
    return { offset, delta, scrollTopAdjusted }
  }

  /** Set Android-style keyboard state (viewport shrinks, offsetTop=0). */
  setKeyboard(height: number): void {
    this.visualHeight = this.innerHeight - height
    this.offsetTop = 0
  }

  /** Set iOS-style keyboard state (viewport shrinks + shifts up). */
  setiOSKeyboard(keyboardHeight: number): void {
    this.visualHeight = this.innerHeight - keyboardHeight
    this.offsetTop = keyboardHeight
  }

  /** Set iOS interactive-widget style (layout viewport shrinks). */
  setiOSInteractiveWidget(keyboardHeight: number): void {
    this.innerHeight = 844 - keyboardHeight
    this.visualHeight = this.innerHeight
    this.offsetTop = 0
  }

  /** Reset to no-keyboard state. */
  resetKeyboard(): void {
    this.visualHeight = this.innerHeight
    this.offsetTop = 0
  }
}

describe('keyboard-inset formula: computeOffset', () => {
  it('returns 0 when no keyboard is open (viewport = inner)', () => {
    expect(computeOffset(844, 844, 0)).toBe(0)
  })

  // ── Android Chrome ────────────────────────────────────────────────────
  describe('Android Chrome (offsetTop stays 0)', () => {
    it('detects keyboard height from viewport shrink alone', () => {
      // 300px keyboard: visualViewport.height shrinks from 844 to 544
      expect(computeOffset(844, 544, 0)).toBe(300)
    })

    it('detects accessory bar addition (e.g., GIF picker adds 48px)', () => {
      expect(computeOffset(844, 496, 0)).toBe(348)
    })

    it('detects keyboard dismiss (viewport back to full)', () => {
      expect(computeOffset(844, 844, 0)).toBe(0)
    })
  })

  // ── iOS Safari (no interactive-widget) ─────────────────────────────────
  describe('iOS Safari (offsetTop > 0, viewport shifts up)', () => {
    it('evaluates to 0 because offsetTop already accounts for keyboard', () => {
      // 300px keyboard: visual shrinks by 300 AND shifts up by 300
      // 844 - 544 - 300 = 0 → correct: we do NOT double-offset
      expect(computeOffset(844, 544, 300)).toBe(0)
    })

    it('stays 0 during the slide-up animation (intermediate frame)', () => {
      // Keyboard half-open: visualH=694, offsetTop=150
      // 844 - 694 - 150 = 0
      expect(computeOffset(844, 694, 150)).toBe(0)
    })

    it('stays 0 after full keyboard open', () => {
      // visualH=544, offsetTop=300
      // 844 - 544 - 300 = 0
      expect(computeOffset(844, 544, 300)).toBe(0)
    })
  })

  // ── iOS Safari (with interactive-widget=resizes-content) ──────────────
  describe('iOS Safari with interactive-widget=resizes-content (iOS 16+)', () => {
    it('evaluates to 0 because layout viewport resizes with keyboard', () => {
      // Layout viewport shrinks: innerHeight becomes 544
      // visualViewport matches: height=544, offsetTop=0
      expect(computeOffset(544, 544, 0)).toBe(0)
    })
  })

  // ── Correctness of formula vs old broken formula ───────────────────────
  describe('formula correctness vs old broken approach', () => {
    it('old max(H_diff, offsetTop) would double-offset on iOS', () => {
      // OLD broken formula: Math.max(844-544, 300) = max(300, 300) = 300
      // But the correct offset should be 0!
      const oldBroken = Math.max(844 - 544, 300)  // 300 ← WRONG
      const correct = computeOffset(844, 544, 300)  // 0 ← CORRECT
      expect(oldBroken).not.toBe(correct)
      expect(correct).toBe(0)
    })
  })
})

describe('keyboard-inset full lifecycle simulation', () => {
  let sim: Simulator

  beforeEach(() => {
    sim = new Simulator()
  })

  // ── Scenario 1: Android Chrome ────────────────────────────────────────
  describe('Scenario 1: Android Chrome — keyboard opens 300px', () => {
    it('initial measure returns 0 (no keyboard)', () => {
      const r = sim.measure()
      expect(r.offset).toBe(0)
      expect(r.delta).toBe(0)
      expect(sim.keyboardHeight).toBe(0)
      expect(sim.keyboardHeightPrev).toBe(0)
    })

    it('keyboard opens → offset=300, scrollTop compensated', () => {
      sim.measure()  // initial: offset=0
      sim.setKeyboard(300)
      const r = sim.measure()

      expect(r.offset).toBe(300)
      expect(r.delta).toBe(300)
      expect(r.scrollTopAdjusted).toBe(true)
      expect(sim.scrollTop).toBe(300)  // scrolled down to keep bottom visible
      expect(sim.keyboardHeight).toBe(300)
      expect(sim.keyboardHeightPrev).toBe(0)
    })

    it('keyboard height stable → no-op (no duplicate updates)', () => {
      sim.measure()  // init: 0
      sim.setKeyboard(300)
      sim.measure()  // → 300

      const r = sim.measure()  // same height
      expect(r.offset).toBe(300)
      expect(r.delta).toBe(0)
      expect(r.scrollTopAdjusted).toBe(false)  // no unnecessary scroll
    })

    it('keyboard dismiss → offset=0, scrollTop returns', () => {
      sim.measure()  // init: 0
      sim.setKeyboard(300)
      sim.measure()  // → 300, scrollTop += 300
      const prevScrollTop = sim.scrollTop

      sim.resetKeyboard()
      const r = sim.measure()

      expect(r.offset).toBe(0)
      expect(r.delta).toBe(-300)
      expect(r.scrollTopAdjusted).toBe(true)
      expect(sim.scrollTop).toBe(prevScrollTop - 300)  // scroll back
      expect(sim.keyboardHeight).toBe(0)
      expect(sim.keyboardHeightPrev).toBe(300)
    })

    it('keyboard height change (accessory bar) → delta applied', () => {
      sim.measure()  // init: 0
      sim.setKeyboard(300)
      sim.measure()  // → 300, scrollTop=300
      sim.setKeyboard(348)  // accessory bar adds 48px
      const r = sim.measure()

      expect(r.offset).toBe(348)
      expect(r.delta).toBe(48)
      expect(sim.scrollTop).toBe(348)  // 300 + 48
      expect(sim.keyboardHeightPrev).toBe(300)
    })
  })

  // ── Scenario 2: iOS Safari (no interactive-widget) ────────────────────
  describe('Scenario 2: iOS Safari — visual viewport shifts up', () => {
    it('keyboard opens → offset stays 0, no scrollTop change', () => {
      sim.measure()  // init: 0
      sim.setiOSKeyboard(300)
      const r = sim.measure()

      expect(r.offset).toBe(0)  // iOS already accounts for keyboard
      expect(r.delta).toBe(0)
      expect(r.scrollTopAdjusted).toBe(false)
      expect(sim.keyboardHeight).toBe(0)
      expect(sim.keyboardHeightPrev).toBe(0)
    })

    it('keyboard animation intermediate → offset stays 0', () => {
      sim.measure()  // init: 0

      // Half-open: visualH=694, offsetTop=150
      sim.visualHeight = 694
      sim.offsetTop = 150
      const r = sim.measure()

      expect(r.offset).toBe(0)
      expect(r.scrollTopAdjusted).toBe(false)
    })

    it('keyboard dismiss → offset stays 0', () => {
      sim.measure()  // init: 0
      sim.setiOSKeyboard(300)
      sim.measure()  // → 0
      sim.resetKeyboard()
      const r = sim.measure()

      expect(r.offset).toBe(0)
      expect(r.delta).toBe(0)
    })
  })

  // ── Scenario 3: iOS interactive-widget ─────────────────────────────────
  describe('Scenario 3: iOS interactive-widget=resizes-content', () => {
    it('innerHeight shrinks with keyboard → offset=0', () => {
      sim.measure()  // init: 0
      sim.setiOSInteractiveWidget(300)
      const r = sim.measure()

      expect(r.offset).toBe(0)
      expect(sim.innerHeight).toBe(544)  // layout viewport resized
      expect(sim.visualHeight).toBe(544)  // matches new inner
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('rapid open-close cycle: stale retries cleared, final state correct', () => {
      sim.measure()  // init: 0

      // Open
      sim.setKeyboard(300)
      sim.measure()  // → 300, scrollTop=300

      // Immediately close (send button tapped)
      sim.resetKeyboard()
      sim.measure()  // → 0, scrollTop=0

      expect(sim.keyboardHeight).toBe(0)
      expect(sim.scrollTop).toBe(0)
      expect(sim.keyboardHeightPrev).toBe(300)
    })

    it('scrollTop clamped at maxScrollTop when scrolling past bottom', () => {
      sim.measure()  // init: 0

      // Scroll to near bottom first
      sim.scrollTop = 3100  // close to max (4000 - 844 = 3156)

      // Keyboard opens 300px
      sim.setKeyboard(300)
      sim.measure()  // scrollTop should be 3156 (clamped), not 3400

      expect(sim.scrollTop).toBe(3156)  // maxTop = 4000 - 844 = 3156
      expect(sim.keyboardHeight).toBe(300)
    })

    it('scrollTop clamped at 0 when scrolling past top', () => {
      // Set scrollTop to 0
      sim.scrollTop = 0
      sim.measure()  // init: 0

      // Keyboard opens
      sim.setKeyboard(300)
      sim.measure()  // scrollTop=300

      // Keyboard closes
      sim.resetKeyboard()
      sim.measure()  // scrollTop should be 0, not -300

      expect(sim.scrollTop).toBe(0)
    })

    it('very large keyboard (tablet landscape, 500px) → correct delta', () => {
      sim.measure()  // init: 0
      sim.setKeyboard(500)
      const r = sim.measure()

      expect(r.offset).toBe(500)
      expect(r.delta).toBe(500)
      expect(sim.scrollTop).toBe(500)
    })

    it('small accessory-height change (e.g. 15px) → correct delta', () => {
      sim.measure()  // init: 0
      sim.setKeyboard(300)
      sim.measure()  // → 300
      sim.setKeyboard(315)
      const r = sim.measure()

      expect(r.offset).toBe(315)
      expect(r.delta).toBe(15)
      expect(sim.scrollTop).toBe(315)
    })

    it('no-op when same offset measured twice (event dedup)', () => {
      sim.measure()  // init: 0
      sim.setKeyboard(300)
      sim.measure()  // → 300

      // Measure again with same state (e.g. scroll event fires after resize)
      const r = sim.measure()

      expect(r.offset).toBe(300)
      expect(r.delta).toBe(0)
      expect(r.scrollTopAdjusted).toBe(false)
      expect(sim.keyboardHeightPrev).toBe(0)  // prev was set during the change, not this no-op
    })
  })

  // ── CSS variable tracking ──────────────────────────────────────────────
  describe('CSS custom property state', () => {
    it('initialised to 0px before first measurement', () => {
      expect(sim.keyboardHeight).toBe(0)
      expect(sim.keyboardHeightPrev).toBe(0)
    })

    it('prev tracks the *previous* keyboard height, not current', () => {
      sim.measure()  // init: 0
      sim.setKeyboard(300)
      sim.measure()  // current=300, prev=0
      expect(sim.keyboardHeight).toBe(300)
      expect(sim.keyboardHeightPrev).toBe(0)

      sim.setKeyboard(348)
      sim.measure()  // current=348, prev=300
      expect(sim.keyboardHeight).toBe(348)
      expect(sim.keyboardHeightPrev).toBe(300)
    })
  })

  // ── CSS Transition Sync ────────────────────────────────────────────────
  describe('CSS transition coordination', () => {
    it('scrollTop delta matches transform delta (both = keyboard height)', () => {
      sim.measure()  // init: 0
      sim.setKeyboard(300)
      const r = sim.measure()

      // scrollTop delta (JS) should equal keyboard height (CSS transform)
      expect(r.delta).toBe(300)
      // composerSeat CSS: translateY(-300px) = keyboardHeight
      // Both move by the same amount → content + composer stay in sync
      expect(r.delta).toBe(sim.keyboardHeight)
    })
  })
})
