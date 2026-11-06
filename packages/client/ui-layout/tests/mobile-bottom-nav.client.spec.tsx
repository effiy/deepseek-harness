// @vitest-environment jsdom
/** Bottom navigation behavior through the production slot renderer. */
import { afterEach, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { MainPanelId } from '../src/client/service.ts'
import { createLayoutStore } from '../src/client/stores.ts'
import { registerBottomNav } from '../src/client/MobileBottomNav.tsx'
import { NAV_NS, navEn, navZh } from '../src/client/locale.ts'

const runtimes: SlotTestRuntime[] = []

afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose()
  vi.unstubAllGlobals()
  localStorage.clear()
})

/** Mount the bar at a phone width through the same registration the plugin apply performs. */
async function setup() {
  vi.stubGlobal('innerWidth', 390)
  const runtime = await SlotTestRuntime.create()
  runtimes.push(runtime)
  const locale = new LocaleRuntime(runtime.ctx)
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  locale.setLocale('en')
  await runtime.declare({ 'shell.bottom': { kind: 'single', scope: 'root' } })
  const instance = createLayoutStore().create()
  const plugin = {
    inject: ['locale', 'slots'],
    apply: (ctx: typeof runtime.ctx) => {
      ctx.effect(() => locale.register(NAV_NS, { zh: navZh, en: navEn }), 'spec: bottom-nav labels')
      ctx.effect(() => registerBottomNav(ctx, instance), 'spec: bottom-nav seat')
    },
  }
  const provider = await runtime.mount(plugin)
  const body = runtime.renderSlot('shell.bottom', {})
  return { locale, instance, provider, body }
}

it('renders the tab bar, switches the main panel, and toggles the narrow sidebar', async () => {
  const { body, instance } = await setup()
  expect(body.view.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
  const chat = body.view.getByRole('button', { name: 'Chat' })
  expect(chat.getAttribute('aria-current')).toBe('page')
  expect(body.view.getByRole('button', { name: 'Reminders' })).toBeTruthy()
  expect(body.view.getByRole('button', { name: 'Settings' })).toBeTruthy()
  const hamburger = body.view.getByRole('button', { name: 'Toggle left sidebar' })
  expect(hamburger.getAttribute('aria-expanded')).toBe('false')
  act(() => { body.view.getByRole('button', { name: 'Workspace' }).click() })
  expect(instance.getSnapshot().panelInfo.activePanelId).toEqual(brandString<MainPanelId>('workspace'))
  expect(body.view.getByRole('button', { name: 'Workspace' }).getAttribute('aria-current')).toBe('page')
  expect(chat.getAttribute('aria-current')).toBeNull()
  // 390px is below the auto-collapse threshold: the toggle flips the narrow
  // override and aria-expanded follows it.
  act(() => { hamburger.click() })
  expect(instance.getSnapshot().layoutInfo.narrowExpanded).toBe(true)
  expect(hamburger.getAttribute('aria-expanded')).toBe('true')
})

it('resolves every label from the active locale dictionary', async () => {
  const { locale, body } = await setup()
  expect(body.view.getByRole('navigation').getAttribute('aria-label')).toBe('Main navigation')
  act(() => { locale.setLocale('zh') })
  expect(body.view.getByRole('navigation', { name: '主导航' })).toBeTruthy()
  for (const label of ['对话', '工作区', '提醒', '设置', '展开／收起左侧栏']) {
    expect(body.view.getByRole('button', { name: label })).toBeTruthy()
  }
})

it('removes the bar when the contributing fiber unloads', async () => {
  const { provider, body } = await setup()
  expect(body.view.getByRole('navigation')).toBeTruthy()
  await provider.dispose()
  expect(body.container.querySelector('nav')).toBeNull()
})
