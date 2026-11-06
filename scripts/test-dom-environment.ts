/** Initial resize and intersection delivery from jsdom's modeled offsets; geometry/timing suites supply their own observers. */
import { afterAll, beforeEach } from 'vitest'

const original = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver')
const originalIntersection = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver')
let installed = false
let installedIntersection = false

class TestResizeObserver implements ResizeObserver {
  private readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    if (this.targets.has(target)) return
    this.targets.add(target)
    const width = target instanceof HTMLElement ? target.offsetWidth : 0
    const height = target instanceof HTMLElement ? target.offsetHeight : 0
    const size = [{ inlineSize: width, blockSize: height }]
    this.callback([{
      target, contentRect: new DOMRectReadOnly(0, 0, width, height),
      borderBoxSize: size, contentBoxSize: size, devicePixelContentBoxSize: size,
    }], this)
  }

  unobserve(target: Element): void { this.targets.delete(target) }
  disconnect(): void { this.targets.clear() }
}

/** jsdom has no layout, so every observed target reports as fully visible; recycling and viewport code keeps the DOM intact. */
class TestIntersectionObserver implements IntersectionObserver {
  private readonly targets = new Set<Element>()

  readonly root: Element | Document | null = null
  readonly rootMargin: string = '0px'
  readonly scrollMargin: string = '0px'
  readonly thresholds: ReadonlyArray<number> = [0]

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    if (this.targets.has(target)) return
    this.targets.add(target)
    const rect = new DOMRectReadOnly(0, 0, 0, 0)
    this.callback([{
      target, time: 0, rootBounds: rect, boundingClientRect: rect, intersectionRect: rect,
      isIntersecting: true, intersectionRatio: 1,
    }], this)
  }

  unobserve(target: Element): void { this.targets.delete(target) }
  disconnect(): void { this.targets.clear() }
  takeRecords(): IntersectionObserverEntry[] { return [] }
}

beforeEach(() => {
  if (typeof document !== 'undefined' && typeof ResizeObserver === 'undefined') {
    // Establish the per-environment default, so vi.unstubAllGlobals restores it.
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, writable: true, value: TestResizeObserver })
    installed = true
  }
  if (typeof document !== 'undefined' && typeof IntersectionObserver === 'undefined') {
    Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: TestIntersectionObserver })
    installedIntersection = true
  }
})

afterAll(() => {
  if (installed) {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'ResizeObserver')
    else Object.defineProperty(globalThis, 'ResizeObserver', original)
  }
  if (installedIntersection) {
    if (originalIntersection === undefined) Reflect.deleteProperty(globalThis, 'IntersectionObserver')
    else Object.defineProperty(globalThis, 'IntersectionObserver', originalIntersection)
  }
})
