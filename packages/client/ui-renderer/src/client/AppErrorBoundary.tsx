/**
 * Application-level error boundary. Wraps the entire component tree so a crash
 * in any descendant produces a standalone fallback UI instead of a white screen.
 *
 * Styles are inline by design: the crash face must render even when the CSS
 * pipeline (tokens, theme, bundling) was itself the source of the crash.
 * Dark-mode support comes from inline prefers-color-scheme media queries
 * applied through a <style> element injected on first render.
 */
import { Component, createElement, type ErrorInfo, type ReactNode } from 'react'

export interface AppErrorBoundaryState {
  crashed: boolean
  error: unknown
  /** Whether the error was copied to clipboard (brief visual feedback). */
  copied: boolean
}

/** True after the first crash face render — avoid duplicate <style> injection. */
let injectedCrashStyles = false

const CRASH_STYLES = /* css */ `
._ceb_root {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; min-height: 100dvh; padding: 2rem;
  background: #f5f5f5; color: #333;
  font-family: system-ui, -apple-system, sans-serif;
}
._ceb_card { text-align: center; max-width: 28rem; padding: 2rem; }
._ceb_icon { font-size: 2.5rem; margin-bottom: 1rem; line-height: 1; }
._ceb_title { font-size: 1.25rem; font-weight: 500; margin: 0 0 .5rem; }
._ceb_text { color: #666; font-size: .875rem; line-height: 1.5; margin: 0 0 1.5rem; }
._ceb_btn {
  display: inline-block; padding: .625rem 1.5rem; font-size: .9375rem;
  font-weight: 500; line-height: 1.5; border: none; border-radius: .5rem;
  background: #1a73e8; color: #fff; cursor: pointer; transition: background .15s;
}
._ceb_btn:hover { background: #1557b0; }
._ceb_btn:active { background: #0d47a1; }
._ceb_btn_secondary {
  display: inline-block; padding: .625rem 1.5rem; font-size: .9375rem;
  font-weight: 500; line-height: 1.5; border: 1px solid #ccc; border-radius: .5rem;
  background: transparent; color: #555; cursor: pointer; transition: background .15s;
}
._ceb_btn_secondary:hover { background: rgba(0,0,0,.06); }
._ceb_btn_secondary:active { background: rgba(0,0,0,.1); }
._ceb_actions { display: flex; gap: .75rem; justify-content: center; margin-bottom: 1.5rem; }
._ceb_details { margin-top: 2rem; text-align: left; color: #666; font-size: .75rem; }
._ceb_details summary { cursor: pointer; padding: .25rem 0; user-select: none; }
._ceb_trace {
  margin-top: .5rem; padding: .75rem; background: rgba(0,0,0,.06);
  border-radius: .375rem; overflow-x: auto; white-space: pre-wrap;
  word-break: break-word; font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
  font-size: .75rem; line-height: 1.4; max-height: 16rem; overflow-y: auto;
}
@media (prefers-color-scheme: dark) {
  ._ceb_root { background: #171717; color: #e5e5e5; }
  ._ceb_text, ._ceb_details { color: #999; }
  ._ceb_details summary:hover { color: #ccc; }
  ._ceb_trace { background: rgba(255,255,255,.06); }
  ._ceb_btn_secondary { border-color: #555; color: #bbb; }
  ._ceb_btn_secondary:hover { background: rgba(255,255,255,.08); }
  ._ceb_btn_secondary:active { background: rgba(255,255,255,.12); }
}`

let nextResetKey = 1

export class AppErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: unknown, info: ErrorInfo) => void },
  AppErrorBoundaryState
> {
  private resetKey = nextResetKey++

  override state: AppErrorBoundaryState = { crashed: false, error: undefined, copied: false }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { crashed: true, error, copied: false }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[AppErrorBoundary] application crash:', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  private handleRetry = (): void => {
    this.resetKey = nextResetKey++
    this.setState({ crashed: false, error: undefined })
  }

  private handleCopy = (): void => {
    const text = stringifyError(this.state.error)
    void navigator.clipboard.writeText(text).then(
      () => { this.setState({ copied: true }); setTimeout(() => { this.setState({ copied: false }) }, 2_000) },
      () => { /* clipboard unavailable — silently ignore */ },
    )
  }

  override render(): ReactNode {
    if (this.state.crashed) {
      if (!injectedCrashStyles) {
        injectedCrashStyles = true
        document.head.insertAdjacentHTML('beforeend', `<style data-dsh-crash-face>${CRASH_STYLES}</style>`)
      }
      return createElement('div', { key: this.resetKey, className: '_ceb_root' },
        createElement('div', { className: '_ceb_card' },
          createElement('div', { className: '_ceb_icon' }, '\u26A0'),
          createElement('h1', { className: '_ceb_title' }, 'Something went wrong'),
          createElement('p', { className: '_ceb_text' },
            'The application encountered an unexpected error. You can try reloading.'),
          createElement('div', { className: '_ceb_actions' },
            createElement('button', {
              className: '_ceb_btn',
              onClick: this.handleRetry,
              type: 'button',
            }, 'Reload'),
            createElement('button', {
              className: '_ceb_btn_secondary',
              onClick: this.handleCopy,
              type: 'button',
            }, this.state.copied ? 'Copied \u2713' : 'Copy error'),
          ),
          createElement('details', { className: '_ceb_details' },
            createElement('summary', null, 'Error details'),
            createElement('pre', { className: '_ceb_trace' },
              stringifyError(this.state.error)),
          ),
        ),
      )
    }
    return this.props.children
  }
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    const parts = [error.stack ?? `${error.name}: ${error.message}`]
    if (error.cause instanceof Error) {
      parts.push(`Caused by: ${error.cause.stack ?? error.cause.message}`)
    }
    return parts.join('\n')
  }
  try {
    return JSON.stringify(error, null, 2)
  } catch {
    return String(error)
  }
}
