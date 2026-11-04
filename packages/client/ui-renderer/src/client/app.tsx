/**
 * Real-UI assembly closure. The whole layout tree hangs from the built-in
 * `root` slot, which is the only ctx-level slot render in the application.
 * The returned factory produces a React tree protected by a root-level error
 * boundary: any uncaught descendant crash renders a fallback face instead of
 * a white screen.
 */
import { createElement, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { AppErrorBoundary } from './AppErrorBoundary.tsx'

/** Inputs available after the UI renderer's inject set activates. */
export interface AssemblyDeps {
  /** Client context carrying the renderer-owned Slot registry. */
  ctx: Context
}

/**
 * Build the assembled application factory.
 * @param deps - Active UI-renderer dependencies.
 * @returns Factory producing the application React tree.
 */
export function buildRenderApp(deps: AssemblyDeps): () => ReactNode {
  const { ctx } = deps
  return () => createElement(AppErrorBoundary, null, ctx.slots.renderSlot('root', {}))
}
