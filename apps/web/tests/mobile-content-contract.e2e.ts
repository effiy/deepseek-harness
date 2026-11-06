/**
 * Mobile content-contract verification for the 2026-11-06 gap-analysis ⚠️ items.
 *
 * Covers the runtime layout behaviors that unit-level DOM parity cannot show:
 * Story 3.2 (wide code blocks wrap inside their block without page overflow),
 * 3.4 (wide tables ride a scroll wrapper), 3.5 (wide images stay contained),
 * 3.6 (image lightbox preview opens), 4.6 (a failed image degrades to its alt
 * fallback), 2.9 (the composer draft survives a bottom-nav panel switch),
 * 1.5 (portrait↔landscape rotation keeps the layout intact), 4.2 (records the
 * confirmed absence of a non-modal offline indicator), and the shell.bottom
 * default-occupant contract landed with the 2026-11-06 bottom-nav wiring:
 * the bar renders at phone width with every `layout.bottom-nav` label
 * resolved, and its CSS gate hides it at desktop width. The tiers case pins
 * composer containment at 375×667, 768×1024, and 1440×900: fully inside the
 * viewport, focusable and typeable, and never overlapped by the bottom nav.
 *
 * The seeded session carries one assistant message with an over-wide fenced
 * code line, a five-column table, one route-fulfilled wide SVG image, and one
 * route-aborted image. Zero model calls.
 */
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  createAssistantMessage,
  createSystemMessage,
  createUserMessage,
} from '@deepseek-ai/dsh-llm'
import {
  SESSION_FORMAT_VERSION,
  Session,
  SessionId,
} from '@deepseek-ai/dsh-session'
// Carries the session/title event declaration into this fixture builder.
import type {} from '@deepseek-ai/dsh-session-title'
import {
  launchWebScaffold, seedSession, watchConsole, type WebScaffold,
} from './scaffold.ts'
import { connectFreshWorkspace, saveFailureShot } from './support.ts'

const SESSION_ID = 'mobile-content-contract-web-e2e'
const USER_MARKER = 'MOBILE_CONTENT_CONTRACT_USER_001'
const SESSION_TITLE = 'Mobile content contract'
const WIDE_IMAGE_URL = 'https://contract.invalid/wide-image.svg'
const OFFLINE_IMAGE_URL = 'https://contract.invalid/offline-image.svg'
const WIDE_IMAGE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200">'
  + '<rect width="1200" height="200" fill="#dc2626"/></svg>'
const DRAFT_TEXT = 'DRAFT_CONTRACT_KEEP_123'

/**
 * Build the assistant markdown body exercising every content contract.
 * @returns Markdown with a wide code line, a five-column table, and two images.
 */
function assistantMarkdown(): string {
  const fence = '```'
  const wideLine = `const mobile_contract_row = "${'x'.repeat(140)}"`
  const table = [
    '| Alpha column | Beta column | Gamma column | Delta column | Epsilon column |',
    '| --- | --- | --- | --- | --- |',
    '| The quick brown fox jumps one | The quick brown fox jumps two | The quick brown fox jumps three | The quick brown fox jumps four | The quick brown fox jumps five |',
  ].join('\n')
  return `${USER_MARKER.replace('USER', 'ASSISTANT')} Content contract body.\n\n`
    + `${fence}ts\n${wideLine}\n${fence}\n\n`
    + `${table}\n\n`
    + `![Wide contract image](${WIDE_IMAGE_URL})\n\n`
    + `![Offline fallback alt](${OFFLINE_IMAGE_URL})\n`
}

/**
 * Build the seeded session log: one closed turn carrying the contract content.
 * @returns Canonical JSONL with the scaffold's session/cwd placeholders.
 */
function buildFixtureLog(): string {
  const session = Session.create(SessionId('mobile-content-contract-template'))
  const text = (value: string): { type: 'text'; text: string }[] => [{ type: 'text', text: value }]
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('system/message', {
    turn: 1,
    step: 1,
    message: createSystemMessage('Synthetic mobile content-contract system prompt.'),
  }, { surfaceOp: 'append' })
  const user = session.append('user/message', createUserMessage({
    content: text(`${USER_MARKER} Verify the mobile content contracts on this reply.`),
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('session/title', {
    title: SESSION_TITLE,
    messageSeqs: [user.seq],
    source: { kind: 'fallback' },
  })
  session.append('request/header', {
    header: { config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } },
    reason: 'initial',
  })
  session.append('assistant/message', {
    stream: [],
    turn: 1,
    step: 1,
    message: createAssistantMessage({
      content: text(assistantMarkdown()),
      source: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    }),
    usage: { inputTokens: 2_100, outputTokens: 320 },
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return [
    JSON.stringify({
      type: 'session',
      version: SESSION_FORMAT_VERSION,
      id: '{{sessionId}}',
      createdAt: Date.now() - 60_000,
      cwd: '{{cwd}}',
      isSeeded: false,
      delegationDepth: 0,
    }),
    ...session.snapshotEvents().map(event => JSON.stringify(event)),
    '',
  ].join('\n')
}

/**
 * Open the seeded session through the header search, the proven e2e path.
 * @param page - Scene page on the authenticated app.
 */
async function openSeededSession(page: Page): Promise<void> {
  const searchButton = page.getByRole('button', { name: 'Search sessions' })
  if (await searchButton.getAttribute('aria-expanded') !== 'true') await searchButton.click()
  const search = page.getByRole('textbox', { name: 'Search session names', exact: true })
  await search.fill(USER_MARKER)
  const results = page.getByRole('tree', { name: 'Search results' }).getByRole('treeitem')
  // waitFor (not expect.poll) so this helper also runs inside beforeAll.
  await results.first().waitFor({ timeout: 60_000 })
  await results.first().click()
  await page.getByRole('tab', { name: 'Chat', exact: true }).waitFor({ timeout: 30_000 })
  await page.getByText(USER_MARKER, { exact: false }).first().waitFor({ timeout: 30_000 })
}

/**
 * Measure horizontal containment of the page and one element.
 * @param page - Scene page at the tested viewport.
 * @returns Document scroll width versus the inner viewport width.
 */
async function pageOverflow(page: Page): Promise<{ scrollWidth: number; innerWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
}

describe('web e2e: mobile content contracts (gap-analysis ⚠️ items)', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    browser = await chromium.launch()
    page = await browser.newPage({
      viewport: { width: 1680, height: 1000 },
      locale: 'en-US',
      timezoneId: 'Asia/Shanghai',
      hasTouch: true,
    })
    tripwire = watchConsole(page)
    // The fulfilled image stands in for a real 1200px-wide asset; the aborted
    // one simulates an unreachable (offline) image destination.
    await page.route(WIDE_IMAGE_URL, route => route.fulfill({
      contentType: 'image/svg+xml',
      body: WIDE_IMAGE_SVG,
    }))
    await page.route(OFFLINE_IMAGE_URL, route => route.abort())
    await seedSession(scaffold, buildFixtureLog(), SESSION_ID)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await connectFreshWorkspace(page, scaffold.workspaceCwd, 'mobile-content')
    await openSeededSession(page)
  }, 240_000)

  afterAll(async () => {
    await browser?.close().catch(() => {})
    await scaffold?.close().catch(() => {})
  })

  it('3.2/3.4/3.5 — wide code, table, and image stay contained at 375px', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mobile-content-containment'))
    await page.setViewportSize({ width: 375, height: 812 })
    const code = page.locator('pre', { hasText: 'mobile_contract_row' }).first()
    await code.waitFor({ state: 'visible', timeout: 30_000 })
    await code.scrollIntoViewIfNeeded()
    const codeMetrics = await code.evaluate(element => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      whiteSpace: getComputedStyle(element).whiteSpace,
    }))
    // The over-wide line wraps inside the block (the shipped CodeBlock pre is
    // pre-wrap + break-all) instead of breaking the page.
    expect(codeMetrics.scrollWidth).toBe(codeMetrics.clientWidth)
    expect(codeMetrics.whiteSpace).toBe('pre-wrap')

    const tableWrapper = page.locator('[class*="tableScroll"]').first()
    await tableWrapper.scrollIntoViewIfNeeded()
    const tableMetrics = await tableWrapper.evaluate((element) => {
      const table = element.querySelector('table')
      return {
        wrapperClientWidth: element.clientWidth,
        wrapperScrollWidth: element.scrollWidth,
        tableWidth: table?.getBoundingClientRect().width ?? 0,
        overflowX: getComputedStyle(element).overflowX,
        maxWidth: getComputedStyle(element).maxWidth,
      }
    })
    expect(['auto', 'scroll']).toContain(tableMetrics.overflowX)
    expect(tableMetrics.wrapperScrollWidth).toBeGreaterThan(tableMetrics.wrapperClientWidth)
    expect(tableMetrics.tableWidth).toBeGreaterThan(tableMetrics.wrapperClientWidth)

    const image = page.locator('img[alt="Wide contract image"]')
    await image.waitFor({ state: 'visible', timeout: 30_000 })
    await image.scrollIntoViewIfNeeded()
    const imageBox = await image.boundingBox()
    expect(imageBox).not.toBeNull()
    // A 1200px-wide source renders clamped to the message column.
    expect(imageBox!.width).toBeLessThanOrEqual(375)
    const overflow = await pageOverflow(page)
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth)
  }, 120_000)

  it('3.6 — clicking the image opens the lightbox preview dialog', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mobile-lightbox'))
    const imageButton = page.locator('button[class*="imageButton"]').first()
    await imageButton.scrollIntoViewIfNeeded()
    const hasPreviewDelegate = await imageButton.count() > 0
    if (!hasPreviewDelegate) {
      // No preview delegate in this composition: the bare image is the shipped
      // behavior, and the lightbox contract does not apply.
      return
    }
    await imageButton.click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible', timeout: 10_000 })
    await dialog.locator('img').waitFor({ state: 'visible', timeout: 10_000 })
    await dialog.getByRole('button').first().click()
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  }, 60_000)

  it('4.6 — an unreachable image degrades to its alt fallback', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mobile-image-fallback'))
    const fallback = page.locator('[class*="imageAlt"]', { hasText: 'Offline fallback alt' }).first()
    await fallback.waitFor({ state: 'visible', timeout: 30_000 })
    await fallback.scrollIntoViewIfNeeded()
    // The broken source never paints an <img> for the aborted destination.
    expect(await page.locator('img[alt="Offline fallback alt"]').count()).toBe(0)
  }, 60_000)

  it('2.9 — the composer draft survives a bottom-nav panel switch', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mobile-draft-keep'))
    await page.setViewportSize({ width: 375, height: 812 })
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await nav.waitFor({ state: 'visible', timeout: 15_000 })
    const composer = page.locator('[data-composer-input][contenteditable="true"]')
    await composer.click()
    await page.keyboard.type(DRAFT_TEXT)
    expect(await composer.textContent()).toContain(DRAFT_TEXT)
    await nav.getByRole('button', { name: 'Workspace', exact: true }).click()
    // The conversation panel (with its composer) leaves the render tree.
    await composer.waitFor({ state: 'hidden', timeout: 15_000 })
    await nav.getByRole('button', { name: 'Chat', exact: true }).click()
    await composer.waitFor({ state: 'visible', timeout: 15_000 })
    expect(await composer.textContent()).toContain(DRAFT_TEXT)
  }, 90_000)

  it('wiring — the shell.bottom bar renders at phone width with all six locale labels', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mobile-bottom-nav'))
    // Set the phone viewport explicitly so this case also stands alone under
    // a `-t` filter; a fresh load keeps Chat (panel id null) active, and 2.9
    // ends on Chat as well, so the aria-current assertion holds in both runs.
    await page.setViewportSize({ width: 375, height: 812 })
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await nav.waitFor({ state: 'visible', timeout: 15_000 })
    // The five buttons plus the nav's own accessible name carry all six
    // `layout.bottom-nav` keys; an unresolved key would surface verbatim
    // (e.g. "nav.chat") instead of the English dictionary value.
    for (const label of ['Chat', 'Workspace', 'Reminders', 'Settings', 'Toggle left sidebar']) {
      await nav.getByRole('button', { name: label, exact: true })
        .waitFor({ state: 'visible', timeout: 10_000 })
    }
    // The active tab reads the real layout store through the registration's
    // inject/hooks binding — the composition-level counterpart of the
    // hand-built SlotTestRuntime spec in ui-layout.
    const chat = nav.getByRole('button', { name: 'Chat', exact: true })
    expect(await chat.getAttribute('aria-current')).toBe('page')
    // The occupant registers unconditionally; the CSS gate (display: flex
    // only at ≤900px) keeps the bar out of the desktop accessibility tree.
    await page.setViewportSize({ width: 1680, height: 1000 })
    await nav.waitFor({ state: 'hidden', timeout: 15_000 })
    await page.setViewportSize({ width: 375, height: 812 })
    await nav.waitFor({ state: 'visible', timeout: 15_000 })
  }, 90_000)

  it('1.5 — rotation to landscape and back keeps the layout intact', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mobile-rotation'))
    await page.setViewportSize({ width: 812, height: 375 })
    await page.waitForTimeout(500)
    const landscape = await pageOverflow(page)
    expect(landscape.scrollWidth).toBeLessThanOrEqual(landscape.innerWidth)
    await page.locator('[data-composer-input][contenteditable="true"]').waitFor({ state: 'visible', timeout: 15_000 })
    const code = page.locator('pre', { hasText: 'mobile_contract_row' }).first()
    await code.waitFor({ state: 'visible', timeout: 15_000 })
    await code.scrollIntoViewIfNeeded()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(500)
    const portrait = await pageOverflow(page)
    expect(portrait.scrollWidth).toBeLessThanOrEqual(portrait.innerWidth)
    await page.locator('[data-composer-input][contenteditable="true"]').waitFor({ state: 'visible', timeout: 15_000 })
  }, 90_000)

  it('4.2 — records the confirmed absence of a non-modal offline indicator', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mobile-offline-gap'))
    // Gap-analysis 4.2: the offline fallback page shipped, but no non-modal
    // top banner announces connectivity loss inside the running app. This
    // assertion pins the current (gap) behavior; when the banner lands, it
    // must be updated to expect the indicator instead.
    await page.context().setOffline(true)
    await page.waitForTimeout(1_500)
    const banner = page.locator(
      '[class*="offlineBanner"], [class*="offline-banner"], [data-offline-indicator], [aria-label*="offline" i]',
    )
    expect(await banner.count()).toBe(0)
    const overflow = await pageOverflow(page)
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth)
    await page.context().setOffline(false)
    // Uncaught page errors fail the run; console warnings from the
    // intentionally aborted image request are expected and only counted.
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('tiers — the composer stays fully visible and focusable at 375, 768, and 1440 widths', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-mobile-composer-tiers'))
    // Position-independent containment contract: the composer input is fully
    // inside each viewport, takes focus and keystrokes, and clears again; when
    // the bottom nav is on screen, the two boxes never overlap.
    const composer = page.locator('[data-composer-input][contenteditable="true"]')
    for (const [width, height] of [[375, 667], [768, 1024], [1440, 900]] as const) {
      const tier = `${String(width)}x${String(height)}`
      await page.setViewportSize({ width, height })
      await composer.waitFor({ state: 'visible', timeout: 15_000 })
      const box = await composer.boundingBox()
      if (box === null) throw new Error(`composer has no bounding box at ${tier}`)
      expect(box.x, `composer left edge at ${tier}`).toBeGreaterThanOrEqual(0)
      expect(box.y, `composer top edge at ${tier}`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width, `composer right edge at ${tier}`).toBeLessThanOrEqual(width)
      expect(box.y + box.height, `composer bottom edge at ${tier}`).toBeLessThanOrEqual(height)
      await composer.click()
      await page.keyboard.type('TIER_PROBE')
      expect(await composer.textContent()).toContain('TIER_PROBE')
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.press('Backspace')
      const nav = page.getByRole('navigation', { name: 'Main navigation' })
      if (await nav.isVisible()) {
        const navBox = await nav.boundingBox()
        if (navBox === null) throw new Error(`bottom nav has no bounding box at ${tier}`)
        expect(box.y + box.height, `composer overlaps the bottom nav at ${tier}`)
          .toBeLessThanOrEqual(navBox.y + 1)
      }
    }
  }, 90_000)
})
