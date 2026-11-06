// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ImageLightbox } from '../src/ImageLightbox.tsx'

afterEach(cleanup)

const labels = { dialog: '原图预览', close: '关闭原图预览' }

/** jsdom has no TouchEvent constructor: dispatch bubbling events carrying touches. */
function makeTouch(type: string, touches: readonly { clientX: number; clientY: number }[]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: touches })
  return event
}

const at = (clientX: number, clientY: number) => ({ clientX, clientY })

describe('ImageLightbox', () => {
  it('focuses its close control, closes by button and Escape, and restores focus', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const onClose = vi.fn()
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={onClose} />)
    const close = view.getByRole('button', { name: '关闭原图预览' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(window, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
    const outerKey = vi.fn()
    document.body.addEventListener('keydown', outerKey)
    try {
      fireEvent.keyDown(close, { key: 'Escape' })
      expect(outerKey).not.toHaveBeenCalled()
    } finally { document.body.removeEventListener('keydown', outerKey) }
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(2)
    view.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('tolerates a focus owner it cannot restore (no active element at mount)', () => {
    // jsdom always reports body as the fallback active element; stub the
    // element-less state a detached focus can leave.
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null })
    try {
      const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={vi.fn()} />)
      view.unmount()
    } finally {
      delete (document as { activeElement?: unknown }).activeElement
    }
  })

  it('closes on a mask press but not on a press over the image', () => {
    const onClose = vi.fn()
    const view = render(<ImageLightbox src="blob:original" alt="原图" labels={labels} onClose={onClose} />)
    fireEvent.mouseDown(view.getByRole('img'))
    expect(onClose).not.toHaveBeenCalled()
    const mask = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.mouseDown(mask)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ImageLightbox touch gestures', () => {
  /** Render and return the stage element and the image. */
  function mount(): { stage: Element; img: HTMLImageElement } {
    const view = render(<ImageLightbox src="blob:original" alt="test" labels={labels} onClose={vi.fn()} />)
    return { stage: view.getByRole('img').parentElement!, img: view.getByRole('img') as HTMLImageElement }
  }

  it('double-tap zooms in to 2.5× and back to fit', () => {
    const { stage, img } = mount()
    const tap = { clientX: 150, clientY: 200 }
    act(() => {
      stage.dispatchEvent(makeTouch('touchstart', [at(tap.clientX, tap.clientY)]))
      stage.dispatchEvent(makeTouch('touchend', []))
      stage.dispatchEvent(makeTouch('touchstart', [at(tap.clientX, tap.clientY)]))
      stage.dispatchEvent(makeTouch('touchend', []))
    })
    expect(img.style.transform).toContain('scale(2.5)')
    act(() => {
      stage.dispatchEvent(makeTouch('touchstart', [at(tap.clientX, tap.clientY)]))
      stage.dispatchEvent(makeTouch('touchend', []))
      stage.dispatchEvent(makeTouch('touchstart', [at(tap.clientX, tap.clientY)]))
      stage.dispatchEvent(makeTouch('touchend', []))
    })
    expect(img.style.transform).toContain('scale(1)')
  })

  it('locks body scroll while open and restores it on unmount', () => {
    const prev = document.body.style.overflow
    const view = render(<ImageLightbox src="blob:original" alt="test" labels={labels} onClose={vi.fn()} />)
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe(prev)
  })

  it('two-finger pinch scales the image between 1× and 5×', () => {
    const { stage, img } = mount()
    // Pinch: initial distance 100 px, move to 200 px → ratio 2 → scale 2.
    act(() => {
      stage.dispatchEvent(makeTouch('touchstart', [at(200, 300), at(300, 300)]))
      stage.dispatchEvent(makeTouch('touchmove', [at(150, 300), at(350, 300)]))
      stage.dispatchEvent(makeTouch('touchend', []))
    })
    expect(img.style.transform).toContain('scale(2)')
  })

  it('clamps zoom at 5× even with a large pinch', () => {
    const { stage, img } = mount()
    // Pinch: initial distance 100 px, move to 600 px → ratio 6 → clamp to 5.
    act(() => {
      stage.dispatchEvent(makeTouch('touchstart', [at(200, 300), at(300, 300)]))
      stage.dispatchEvent(makeTouch('touchmove', [at(0, 300), at(600, 300)]))
      stage.dispatchEvent(makeTouch('touchend', []))
    })
    expect(img.style.transform).toContain('scale(5)')
  })

  it('snaps back to fit when the final scale is ≤ 1.01', () => {
    const { stage, img } = mount()
    // Pinch: barely move → ratio ~1.01 → scale 1.01 ≤ SNAP_THRESHOLD → snap to 1.
    act(() => {
      stage.dispatchEvent(makeTouch('touchstart', [at(200, 300), at(300, 300)]))
      // Move from distance 100→101 produces ratio 1.01.
      stage.dispatchEvent(makeTouch('touchmove', [at(199.5, 300), at(300.5, 300)]))
      stage.dispatchEvent(makeTouch('touchend', []))
    })
    expect(img.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('pans the image with a single finger when already zoomed', () => {
    const { stage, img } = mount()
    // First pinch to zoom in.
    act(() => {
      stage.dispatchEvent(makeTouch('touchstart', [at(200, 300), at(300, 300)]))
      stage.dispatchEvent(makeTouch('touchmove', [at(150, 300), at(350, 300)]))
      stage.dispatchEvent(makeTouch('touchend', []))
    })
    const afterZoom = img.style.transform
    // Then pan: drag one finger 30 px right and 10 px down.
    act(() => {
      stage.dispatchEvent(makeTouch('touchstart', [at(200, 300)]))
      stage.dispatchEvent(makeTouch('touchmove', [at(230, 310)]))
      stage.dispatchEvent(makeTouch('touchend', []))
    })
    const afterPan = img.style.transform
    expect(afterPan).not.toBe(afterZoom)
    expect(afterPan).toContain('scale(2)')
  })

  it('stops body scroll from leaking (overflow hidden on the backdrop)', () => {
    const view = render(<ImageLightbox src="blob:original" alt="test" labels={labels} onClose={vi.fn()} />)
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
  })
})
