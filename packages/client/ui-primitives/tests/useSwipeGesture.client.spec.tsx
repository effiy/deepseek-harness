// @vitest-environment jsdom
/**
 * The swipe-gesture hook as observable touch behavior: direction recognition
 * past the threshold, vertical-scroll and short-move rejection, the swiped-ref
 * lifecycle that suppresses the post-swipe click, and safe partial callbacks.
 */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import { useSwipeGesture, type SwipeHandlers } from '@deepseek-ai/dsh-client-ui-primitives'

afterEach(cleanup)

/** jsdom has no TouchEvent constructor: dispatch bubbling events carrying touches. */
function dispatchTouch(element: Element, type: string, touches: readonly { clientX: number; clientY: number }[]): void {
  act(() => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'touches', { value: touches })
    element.dispatchEvent(event)
  })
}

const at = (clientX: number, clientY: number) => [{ clientX, clientY }]

/** The swiped ref of the most recently mounted host (hosts mount one at a time). */
let captured: RefObject<boolean> | null = null

/** Host surface wiring the hook exactly as its doc example: handlers spread onto one element. */
function SwipeHost({ handlers, threshold }: { handlers: SwipeHandlers; threshold: number | undefined }) {
  const swipe = useSwipeGesture(handlers, threshold)
  captured = swipe.swiped
  return (
    <div
      data-testid="host"
      onTouchStart={swipe.onTouchStart}
      onTouchMove={swipe.onTouchMove}
      onTouchEnd={swipe.onTouchEnd}
    />
  )
}

function mountHost(handlers: SwipeHandlers, threshold?: number) {
  captured = null
  const view = render(<SwipeHost handlers={handlers} threshold={threshold} />)
  const host = view.getByTestId('host')
  const swiped = (): boolean | null => {
    if (captured === null) throw new Error('host not mounted')
    return captured.current
  }
  /** One full touch sequence: start at `from`, a single move to `to`, then lift. */
  const swipe = (from: { x: number; y: number }, to: { x: number; y: number }): void => {
    dispatchTouch(host, 'touchstart', at(from.x, from.y))
    dispatchTouch(host, 'touchmove', at(to.x, to.y))
    dispatchTouch(host, 'touchend', [])
  }
  return { host, swiped, swipe }
}

describe('useSwipeGesture', () => {
  it('fires onSwipeRight on a right swipe past the threshold', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { swipe, swiped } = mountHost({ onSwipeLeft, onSwipeRight })
    swipe({ x: 100, y: 200 }, { x: 150, y: 200 })
    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(onSwipeLeft).not.toHaveBeenCalled()
    // The flag stays true after touchend so the subsequent click can read it.
    expect(swiped()).toBe(true)
  })

  it('fires onSwipeLeft on a left swipe past the threshold', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { swipe } = mountHost({ onSwipeLeft, onSwipeRight })
    swipe({ x: 200, y: 200 }, { x: 150, y: 200 })
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('rejects a diagonal scroll gesture (horizontal:vertical under 2:1)', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { swipe, swiped } = mountHost({ onSwipeLeft, onSwipeRight })
    swipe({ x: 100, y: 100 }, { x: 150, y: 200 }) // dx 50, dy 100: 50 ≤ 2·100
    expect(onSwipeRight).not.toHaveBeenCalled()
    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(swiped()).toBe(false)
  })

  it('rejects a move that stays under the default 30px threshold', () => {
    const onSwipeRight = vi.fn()
    const { swipe, swiped } = mountHost({ onSwipeRight })
    swipe({ x: 100, y: 100 }, { x: 125, y: 100 }) // dx 25 ≤ 30
    expect(onSwipeRight).not.toHaveBeenCalled()
    expect(swiped()).toBe(false)
  })

  it('applies a custom threshold when provided', () => {
    const onSwipeRight = vi.fn()
    const { swipe } = mountHost({ onSwipeRight }, 60)
    swipe({ x: 100, y: 100 }, { x: 150, y: 100 }) // dx 50 ≤ 60: rejected
    expect(onSwipeRight).not.toHaveBeenCalled()
    swipe({ x: 100, y: 100 }, { x: 170, y: 100 }) // dx 70 > 60: recognized
    expect(onSwipeRight).toHaveBeenCalledTimes(1)
  })

  it('keeps swiped true through touchend and resets it on the next touchstart', () => {
    const { swipe, host, swiped } = mountHost({ onSwipeRight: vi.fn() })
    swipe({ x: 100, y: 100 }, { x: 150, y: 100 })
    expect(swiped()).toBe(true)
    dispatchTouch(host, 'touchstart', at(100, 100))
    expect(swiped()).toBe(false)
  })

  it('fires nothing on touchend when no direction was recognized', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { host } = mountHost({ onSwipeLeft, onSwipeRight })
    dispatchTouch(host, 'touchstart', at(100, 100))
    dispatchTouch(host, 'touchmove', at(110, 100)) // under threshold: no recognition
    dispatchTouch(host, 'touchend', [])
    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('ignores touch events with an empty touches list', () => {
    const onSwipeRight = vi.fn()
    const { host, swiped } = mountHost({ onSwipeRight })
    dispatchTouch(host, 'touchstart', [])
    dispatchTouch(host, 'touchmove', [])
    dispatchTouch(host, 'touchend', [])
    expect(onSwipeRight).not.toHaveBeenCalled()
    expect(swiped()).toBe(false)
  })

  it('locks the first recognized direction for the rest of the gesture', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { host } = mountHost({ onSwipeLeft, onSwipeRight })
    dispatchTouch(host, 'touchstart', at(100, 100))
    dispatchTouch(host, 'touchmove', at(150, 100)) // recognized: right
    dispatchTouch(host, 'touchmove', at(40, 100)) // dir already set: ignored
    dispatchTouch(host, 'touchend', [])
    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('tolerates a missing onSwipeLeft on a left swipe', () => {
    const onSwipeRight = vi.fn()
    const { swipe, swiped } = mountHost({ onSwipeRight })
    swipe({ x: 200, y: 100 }, { x: 150, y: 100 }) // left, no left callback declared
    expect(onSwipeRight).not.toHaveBeenCalled()
    expect(swiped()).toBe(true) // recognized as a swipe even without a callback
  })

  it('tolerates a missing onSwipeRight on a right swipe', () => {
    const onSwipeLeft = vi.fn()
    const { swipe } = mountHost({ onSwipeLeft })
    swipe({ x: 100, y: 100 }, { x: 150, y: 100 }) // right, no right callback declared
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })
})
