// @vitest-environment jsdom
/**
 * The left-edge touch zone rendered directly with hand-built props: presence
 * follows the collapsed fact, tap opens the sidebar, right-swipe opens it
 * through the gesture hook, and the click trailing a swipe is suppressed so
 * one gesture never toggles twice.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { en as commonEn } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'
import { SidebarEdgeZone, type SidebarEdgeZoneProps } from '../src/client/SidebarEdgeZone.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t: SidebarEdgeZoneProps['t'] = makeTranslate({ ...commonEn, ...en })

// The zone reads only its injected collapsed hook; the global seats ride the
// standard props share and must never be called.
const neverHook = (() => { throw new Error('edge zone must not read global hooks') }) as never
const standard: GlobalStandardProps = {
  useSessions: neverHook,
  useSessionStatus: neverHook,
  useSessionRetainInfo: neverHook,
  usePanelInfo: neverHook,
  useResource: neverHook,
  useWorkspaces: neverHook,
}

/** jsdom has no TouchEvent constructor: dispatch bubbling events carrying touches. */
function dispatchTouch(element: Element, type: string, touches: readonly { clientX: number; clientY: number }[]): void {
  act(() => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'touches', { value: touches })
    element.dispatchEvent(event)
  })
}

function mountZone({ collapsed = true }: { collapsed?: boolean } = {}) {
  const toggleSidebar = vi.fn()
  const useSidebarCollapsed: SidebarEdgeZoneProps['useSidebarCollapsed'] = selector => selector(collapsed)
  render(<SidebarEdgeZone toggleSidebar={toggleSidebar} useSidebarCollapsed={useSidebarCollapsed} t={t} {...standard} />)
  return { toggleSidebar, zone: () => screen.getByRole('button', { name: en['toggle.open'] }) }
}

/** One full swipe sequence on the zone: start, a single move, then lift. */
function swipeZone(zone: Element, from: { x: number; y: number }, to: { x: number; y: number }): void {
  dispatchTouch(zone, 'touchstart', [{ clientX: from.x, clientY: from.y }])
  dispatchTouch(zone, 'touchmove', [{ clientX: to.x, clientY: to.y }])
  dispatchTouch(zone, 'touchend', [])
}

describe('SidebarEdgeZone', () => {
  it('renders only while the sidebar is collapsed', () => {
    mountZone({ collapsed: false })
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    const { zone } = mountZone({ collapsed: true })
    expect(zone()).not.toBeNull()
  })

  it('opens the sidebar on tap', () => {
    const { toggleSidebar, zone } = mountZone()
    fireEvent.click(zone())
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('opens the sidebar on a right swipe', () => {
    const { toggleSidebar, zone } = mountZone()
    swipeZone(zone(), { x: 8, y: 300 }, { x: 58, y: 300 })
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('suppresses the click trailing a swipe, then accepts a fresh tap', () => {
    const { toggleSidebar, zone } = mountZone()
    swipeZone(zone(), { x: 8, y: 300 }, { x: 58, y: 300 }) // opens via the swipe callback
    fireEvent.click(zone()) // the browser's trailing click must not toggle again
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
    dispatchTouch(zone(), 'touchstart', [{ clientX: 8, clientY: 300 }]) // a fresh touch resets the flag
    dispatchTouch(zone(), 'touchend', [])
    fireEvent.click(zone())
    expect(toggleSidebar).toHaveBeenCalledTimes(2)
  })
})
