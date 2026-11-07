// @vitest-environment jsdom
/** Bottom navigation behavior through the production slot renderer. */
import type { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it, vi } from 'vitest'
import { act, waitFor, within } from '@testing-library/react'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { PropsRuntime, SlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '../src/client/index.ts'
import type { ILayout, MainPanelId, PanelInfo } from '../src/client/service.ts'
import { LayoutController } from '../src/client/service.ts'
import { createLayoutStore } from '../src/client/stores.ts'
import { registerBottomNav } from '../src/client/MobileBottomNav.tsx'
import { NAV_NS, navEn, navZh } from '../src/client/locale.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'bottom-nav-test': 'panel'
  }
}

const PLUGINS = 'bottom-nav-plugins' as MainPanelId
const SCHEDULES = 'bottom-nav-schedules' as MainPanelId
const UNLABELED = 'bottom-nav-unlabeled' as MainPanelId
const ORPHAN = 'bottom-nav-orphan' as MainPanelId
const runtimes: SlotTestRuntime[] = []

afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose()
  vi.unstubAllGlobals()
  localStorage.clear()
})

/**
 * Mount the bar at a phone width through the same registration the plugin
 * apply performs, dispatching through a real LayoutController over the shared
 * store so panel selection is validated against the live `main` ledger.
 */
async function setup() {
  vi.stubGlobal('innerWidth', 390)
  const runtime = await SlotTestRuntime.create()
  runtimes.push(runtime)
  const locale = new LocaleRuntime(runtime.ctx)
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  locale.setLocale('en')
  await runtime.declare({
    'shell.bottom': { kind: 'single', scope: 'root' },
    'main': { kind: 'keyed', scope: 'root' },
  })
  const instance = createLayoutStore().create()
  const panelInfo: ILayout['panelInfo'] = {
    getSnapshot: (): PanelInfo => instance.getSnapshot().panelInfo,
    subscribe: listener => instance.subscribe(listener),
  }
  const layout = new LayoutController(
    instance.actions,
    id => runtime.slots.entries('main').some(entry => entry.options.key === id),
    panelInfo,
    createSnapshotStore(false),
  )
  const provider = await runtime.mount({
    inject: ['locale', 'slots'],
    apply: (ctx: typeof runtime.ctx) => {
      ctx.effect(() => locale.register(NAV_NS, { zh: navZh, en: navEn }), 'spec: bottom-nav labels')
      ctx.effect(() => locale.register('bottom-nav-test', {
        zh: { panel: '自动化任务' }, en: { panel: 'Automation tasks' },
      }), 'spec: feature panel label')
      ctx.effect(() => registerBottomNav(ctx, instance, layout), 'spec: bottom-nav seat')
    },
  })
  const body = runtime.renderSlot('shell.bottom', {})
  return { runtime, locale, instance, layout, provider, body }
}

/** Register the panel body a tab selects; the bar offers no tab without it. */
async function mountMain(runtime: SlotTestRuntime, id: MainPanelId, heading: string) {
  return runtime.mount({
    inject: ['slots'],
    apply(ctx: Context) {
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: id }, () => <h1>{heading}</h1>))
    },
  })
}

interface TestTab {
  id: MainPanelId
  order?: number
  label?: SlotLabel
}

/** Contribute one tab icon to the bar's ledger. */
async function mountTab(runtime: SlotTestRuntime, metadata: TestTab) {
  function Icon({ size, active }: PropsRuntime<'bottom-nav.tab'>) {
    return <span data-testid={`${metadata.id}-icon`} data-size={size} data-active={active} />
  }
  return runtime.mount({
    inject: ['slots'],
    apply(ctx: Context) {
      ctx.slots.inject('bottom-nav.tab', () => ctx.slots.register({ name: 'bottom-nav.tab', ...metadata }, Icon))
    },
  })
}

/** The tab buttons in DOM order, the hamburger excluded. */
function tabButtons(body: { view: ReturnType<SlotTestRuntime['renderSlot']>['view'] }) {
  return body.view.getAllByRole('button').filter(button => button.getAttribute('aria-label') !== 'Toggle left sidebar')
}

it('renders Chat plus one tab per openable ledger entry, in ascending order', async () => {
  const { runtime, body } = await setup()
  expect(body.view.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
  expect(tabButtons(body).map(button => button.textContent)).toEqual(['Chat'])

  await mountMain(runtime, PLUGINS, 'Plugins content')
  await mountTab(runtime, { id: PLUGINS, order: 0, label: 'Plugins' })
  await mountMain(runtime, SCHEDULES, 'Schedules content')
  await mountTab(runtime, { id: SCHEDULES, order: 10, label: 'Automation tasks' })
  // No `main` entry: the frame cannot open the panel, so the bar offers no tab.
  await mountTab(runtime, { id: ORPHAN, order: 5 })
  // An omitted label falls back to the panel id.
  await mountMain(runtime, UNLABELED, 'Unlabeled content')
  await mountTab(runtime, { id: UNLABELED, order: 20 })

  await waitFor(() => { expect(tabButtons(body)).toHaveLength(4) })
  expect(tabButtons(body).map(button => button.textContent)).toEqual(['Chat', 'Plugins', 'Automation tasks', UNLABELED])
  const chat = body.view.getByRole('button', { name: 'Chat' })
  expect(chat.getAttribute('aria-current')).toBe('page')
  const plugins = body.view.getByRole('button', { name: 'Plugins' })
  expect(plugins.getAttribute('aria-current')).toBeNull()
  const icon = within(plugins).getByTestId(`${PLUGINS}-icon`)
  expect(icon.getAttribute('data-size')).toBe('20')
  expect(icon.getAttribute('data-active')).toBe('false')
  expect(body.view.queryByRole('button', { name: ORPHAN })).toBeNull()
})

it('selects panels through the validated layout face and toggles the narrow sidebar', async () => {
  const { runtime, instance, body } = await setup()
  await mountMain(runtime, PLUGINS, 'Plugins content')
  await mountTab(runtime, { id: PLUGINS, order: 0, label: 'Plugins' })
  await mountMain(runtime, SCHEDULES, 'Schedules content')
  await mountTab(runtime, { id: SCHEDULES, order: 10, label: 'Automation tasks' })

  const chat = body.view.getByRole('button', { name: 'Chat' })
  const plugins = await body.view.findByRole('button', { name: 'Plugins' })
  act(() => { plugins.click() })
  expect(instance.getSnapshot().panelInfo.activePanelId).toEqual(PLUGINS)
  expect(plugins.getAttribute('aria-current')).toBe('page')
  expect(within(plugins).getByTestId(`${PLUGINS}-icon`).getAttribute('data-active')).toBe('true')
  expect(chat.getAttribute('aria-current')).toBeNull()

  act(() => { body.view.getByRole('button', { name: 'Automation tasks' }).click() })
  expect(instance.getSnapshot().panelInfo.activePanelId).toEqual(SCHEDULES)
  expect(plugins.getAttribute('aria-current')).toBeNull()

  act(() => { chat.click() })
  expect(instance.getSnapshot().panelInfo.activePanelId).toBeNull()
  expect(chat.getAttribute('aria-current')).toBe('page')

  // 390px is below the auto-collapse threshold: the toggle flips the narrow
  // override and aria-expanded follows it.
  const hamburger = body.view.getByRole('button', { name: 'Toggle left sidebar' })
  expect(hamburger.getAttribute('aria-expanded')).toBe('false')
  act(() => { hamburger.click() })
  expect(instance.getSnapshot().layoutInfo.narrowExpanded).toBe(true)
  expect(hamburger.getAttribute('aria-expanded')).toBe('true')
})

it('follows the main ledger: a tab appears with its panel and leaves with it', async () => {
  const { runtime, body } = await setup()
  await mountTab(runtime, { id: PLUGINS, order: 0, label: 'Plugins' })
  expect(tabButtons(body).map(button => button.textContent)).toEqual(['Chat'])

  const panel = await mountMain(runtime, PLUGINS, 'Plugins content')
  await waitFor(() => { expect(tabButtons(body).map(button => button.textContent)).toEqual(['Chat', 'Plugins']) })

  await panel.dispose()
  await waitFor(() => { expect(tabButtons(body).map(button => button.textContent)).toEqual(['Chat']) })
  expect(runtime.slots.entries('bottom-nav.tab')).toHaveLength(1)
})

it('resolves every label from the active locale dictionary', async () => {
  const { runtime, locale, body } = await setup()
  const t = locale.bind('bottom-nav-test')
  await mountMain(runtime, SCHEDULES, 'Schedules content')
  await mountTab(runtime, { id: SCHEDULES, order: 0, label: () => t('panel') })
  await mountMain(runtime, PLUGINS, 'Plugins content')
  await mountTab(runtime, { id: PLUGINS, order: 10, label: 'Plugins' })
  expect(body.view.getByRole('navigation').getAttribute('aria-label')).toBe('Main navigation')
  await waitFor(() => { expect(body.view.getByRole('button', { name: 'Automation tasks' })).toBeTruthy() })

  act(() => { locale.setLocale('zh') })
  expect(body.view.getByRole('navigation', { name: '主导航' })).toBeTruthy()
  for (const label of ['对话', '自动化任务', '展开／收起左侧栏']) {
    expect(body.view.getByRole('button', { name: label })).toBeTruthy()
  }
  // A plain-string label is the contributor's own copy and stays put.
  expect(body.view.getByRole('button', { name: 'Plugins' })).toBeTruthy()
})

it('removes the bar and the tab declaration when the contributing fiber unloads', async () => {
  const { runtime, provider, body } = await setup()
  await mountMain(runtime, PLUGINS, 'Plugins content')
  await mountTab(runtime, { id: PLUGINS, order: 0, label: 'Plugins' })
  await waitFor(() => { expect(body.view.getByRole('button', { name: 'Plugins' })).toBeTruthy() })

  await provider.dispose()
  expect(body.container.querySelector('nav')).toBeNull()
  // The declaration is the bar's own: it collapses with the registration,
  // taking the contributed tab entries with it.
  expect(runtime.slots.spec('bottom-nav.tab')).toBeUndefined()
  expect(runtime.slots.entries('bottom-nav.tab')).toEqual([])
})
