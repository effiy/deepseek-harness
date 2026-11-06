import { describe, expect, it } from 'vitest'
import { createTapGuard, TAP_GUARD_WINDOW_MS } from '../src/tap-guard.ts'

describe('createTapGuard', () => {
  it('accepts the first tap and ignores a same-key repeat inside the window', () => {
    let clock = 0
    const guard = createTapGuard(TAP_GUARD_WINDOW_MS, () => clock)
    expect(guard.accept('send')).toBe(true)
    clock += TAP_GUARD_WINDOW_MS - 1
    expect(guard.accept('send')).toBe(false)
  })

  it('accepts the same key again once the window has elapsed', () => {
    let clock = 0
    const guard = createTapGuard(TAP_GUARD_WINDOW_MS, () => clock)
    expect(guard.accept('send')).toBe(true)
    clock += TAP_GUARD_WINDOW_MS
    expect(guard.accept('send')).toBe(true)
  })

  it('keeps windows independent per key and defaults to one shared key', () => {
    const clock = 0
    const guard = createTapGuard(TAP_GUARD_WINDOW_MS, () => clock)
    expect(guard.accept('stop')).toBe(true)
    expect(guard.accept('send')).toBe(true)
    expect(guard.accept()).toBe(true)
    expect(guard.accept()).toBe(false)
    expect(guard.accept('stop')).toBe(false)
  })

  it('reads the performance clock by default', () => {
    const guard = createTapGuard(TAP_GUARD_WINDOW_MS)
    expect(guard.accept('key')).toBe(true)
    // Back-to-back calls are far inside the window on the real clock.
    expect(guard.accept('key')).toBe(false)
  })
})
