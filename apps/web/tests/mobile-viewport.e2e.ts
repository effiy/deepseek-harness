/**
 * Mobile viewport layout tests for the DeepSeek Harness Web GUI.
 *
 * Verifies key layout properties at standard mobile breakpoints:
 * - 375px (iPhone SE / small phone)
 * - 414px (iPhone 11 / medium phone)
 * - 768px (iPad mini / small tablet)
 *
 * Checks: no horizontal overflow, key controls are visible,
 * fixed-position elements stay within viewport.
 *
 * Web GUI lane: see apps/web/tests/README.md and scaffold.ts.
 */
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { expect, it, onTestFinished, describe } from 'vitest'
import { launchWebScaffold } from './scaffold.ts'

// ── Viewport presets ────────────────────────────────────

interface Viewport {
  width: number
  height: number
}

const MOBILE_VIEWPORTS: Record<string, Viewport> = {
  '375px (iPhone SE)': { width: 375, height: 812 },
  '414px (iPhone 11)': { width: 414, height: 896 },
  '768px (iPad mini)': { width: 768, height: 1024 },
}

// ── Helpers ─────────────────────────────────────────────

/**
 * Create a browser page at the given viewport size.
 * Matches the English locale convention of the test lane.
 */
async function createMobilePage(browser: Browser, viewport: Viewport): Promise<Page> {
  const context = await browser.newContext({
    viewport,
    locale: 'en-US',
    timezoneId: 'Asia/Shanghai',
  })
  onTestFinished(() => context.close())
  return await context.newPage()
}

// ── Tests ───────────────────────────────────────────────

describe('mobile viewport layout', () => {
  for (const [label, viewport] of Object.entries(MOBILE_VIEWPORTS)) {
    describe(label, () => {
      it('has no horizontal overflow on document element', async () => {
        const scaffold = await launchWebScaffold({})
        onTestFinished(() => scaffold.close())
        const browser = await chromium.launch()
        onTestFinished(() => browser.close())
        const page = await createMobilePage(browser, viewport)

        await page.goto(scaffold.authenticatedUrl, { waitUntil: 'domcontentloaded' })
        // Wait for the app shell to render
        await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 })

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          windowWidth: window.innerWidth,
        }))

        // Allow 1px tolerance for subpixel rendering
        expect(
          overflow.scrollWidth,
          `scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1)
      })

      it('has the app shell body visible', async () => {
        const scaffold = await launchWebScaffold({})
        onTestFinished(() => scaffold.close())
        const browser = await chromium.launch()
        onTestFinished(() => browser.close())
        const page = await createMobilePage(browser, viewport)

        await page.goto(scaffold.authenticatedUrl, { waitUntil: 'domcontentloaded' })
        await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 })

        const body = page.locator('body')
        await expect(body).toBeVisible()

        // The page should have at least one interactive region
        const regionCount = await page.locator('[role]').count()
        expect(regionCount, 'page should contain accessible regions').toBeGreaterThan(0)
      })

      it('keeps fixed-position elements within viewport', async () => {
        const scaffold = await launchWebScaffold({})
        onTestFinished(() => scaffold.close())
        const browser = await chromium.launch()
        onTestFinished(() => browser.close())
        const page = await createMobilePage(browser, viewport)

        await page.goto(scaffold.authenticatedUrl, { waitUntil: 'domcontentloaded' })
        await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 })

        const offenders = await page.evaluate(() => {
          const vw = window.innerWidth
          const results: Array<{ tag: string; right: number; bottom: number }> = []
          for (const el of document.querySelectorAll('*')) {
            const style = window.getComputedStyle(el)
            if (style.position === 'fixed') {
              const rect = el.getBoundingClientRect()
              if (rect.right > vw + 2) {
                results.push({
                  tag: el.tagName.toLowerCase(),
                  right: Math.round(rect.right),
                  bottom: Math.round(rect.bottom),
                })
              }
            }
          }
          return results
        })

        if (offenders.length > 0) {
          const summary = offenders
            .slice(0, 5)
            .map(o => `<${o.tag}> right=${o.right}px (viewport=${viewport.width}px)`)
            .join(', ')
          console.warn(`Fixed elements exceeding viewport at ${label}: ${summary}`)
        }
        // Soft assertion: log but don't fail for now (may need UI fixes)
        expect(offenders.length, `fixed elements exceed viewport width`).toBe(0)
      })
    })
  }
})

/**
 * Cross-viewport consistency: verify all three breakpoints
 * load without errors.
 */
describe('cross-viewport consistency', () => {
  it('loads without console errors at all mobile sizes', async () => {
    const scaffold = await launchWebScaffold({})
    onTestFinished(() => scaffold.close())

    for (const [label, viewport] of Object.entries(MOBILE_VIEWPORTS)) {
      const browser = await chromium.launch()
      const page = await createMobilePage(browser, viewport)

      const errors: string[] = []
      page.on('pageerror', (err) => { errors.push(err.message) })

      await page.goto(scaffold.authenticatedUrl, { waitUntil: 'domcontentloaded' })
      await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 })
      // Small delay for async renders
      await page.waitForTimeout(1000)

      await browser.close()

      if (errors.length > 0) {
        console.warn(`Console errors at ${label}:`, errors.slice(0, 3))
      }
      expect(errors, `should have no page errors at ${label}`).toEqual([])
    }
  })
})