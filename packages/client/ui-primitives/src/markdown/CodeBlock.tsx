import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { writeClipboard } from '../clipboard.ts'
import { CodeToolbar, type CodeToolbarLabels } from '../CodeToolbar.tsx'
import {
  StreamingHighlightSession, grammarLoadCount, highlightToHtml, subscribeGrammarLoaded,
} from './highlight.ts'
import type { HighlightSpan, StreamingHighlightFrame } from './highlight.ts'
import { useViewportHighlighting } from './useViewportHighlighting.ts'
import { IconCloseOutlineRegular, IconRightUpOutlineRegular } from '../icons/index.tsx'
import css from './CodeBlock.module.css'

export interface CodeBlockProps {
  /** The source text, rendered verbatim (trailing newline trimmed for display). */
  code: string
  /** Grammar hint (markdown fence info string or a fixed caller id); unknown = plain. */
  lang?: string | undefined
  /**
   * The code is still growing (a streaming markdown fence): highlight through
   * a per-instance {@link StreamingHighlightSession}, which re-tokenizes only
   * appended text and keeps completed line groups (and DOM) untouched. The
   * caller must keep the component instance stable across growth (a
   * stream-stable React key); an unchanged streamed fence also retains that
   * tree when it settles. Cold settled callers get shiki's HTML.
   */
  streaming?: boolean | undefined
  /** Extra class merged onto the wrapper (callers position; this component draws). */
  className?: string | undefined
  /** Ref for the stable source-content wrapper, for owners that use it as a scrollport. */
  contentRef?: Ref<HTMLDivElement> | undefined
  /** Show a numbered gutter without adding numbers to copied source. Defaults to false. */
  lineNumbers?: boolean | undefined
  /** Show the language and copy header; false when the caller supplies a toolbar. Defaults to true. */
  showHeader?: boolean | undefined
  /** Copy-button idle label; the owner passes localized copy (this package is cordis-free, so copy arrives via props). */
  copyLabel: string
  /** Copy-button label during the post-copy confirmation window. */
  copiedLabel: string
  /** Enable the shared card toolbar and spacing; omit for custom toolbar layouts. */
  toolbarLabels?: CodeToolbarLabels | undefined
  /** With toolbarLabels, use the owner's wrapping preference and omit the toolbar's local wrap action. */
  wrap?: boolean | undefined
  /** Label for the fullscreen expand button. When set, an expand button appears
   *  for non-streaming code blocks and opens a full-viewport overlay. */
  fullscreenLabel?: string | undefined
  /** Accessible label for the fullscreen overlay close control. */
  fullscreenCloseLabel?: string | undefined
}

/**
 * The `pre` attributes shiki's HTML arm emits for the css-variables theme,
 * mirrored so the streaming arm's tree is interchangeable with the settled
 * swap (`tests/streaming-code-block.client.spec.tsx` pins the two arms'
 * parity).
 */
const SHIKI_PRE_PROPS = {
  className: 'shiki css-variables',
  style: { backgroundColor: 'var(--shiki-background)', color: 'var(--shiki-foreground)' },
  tabIndex: 0,
} as const

/** Completed-line group size; React reconciles groups while the DOM remains line-for-line identical. */
const STREAMING_LINE_GROUP_SIZE = 32

function renderLine(line: readonly HighlightSpan[], index: number): ReactNode {
  return (
    <Fragment key={index}>
      {index > 0 && '\n'}
      <span className="line">
        {line.map((span, spanIndex) => <span key={spanIndex} style={span.style}>{span.text}</span>)}
      </span>
    </Fragment>
  )
}

export function CodeBlock({
  code, lang, streaming, className, contentRef, lineNumbers = false, showHeader = true,
  copyLabel, copiedLabel, toolbarLabels, wrap, fullscreenLabel, fullscreenCloseLabel,
}: CodeBlockProps) {
  const trimmed = code.endsWith('\n') ? code.slice(0, -1) : code
  const sourceLines = lineNumbers ? trimmed.split('\n') : undefined
  const rootRef = useRef<HTMLDivElement>(null)
  const highlighting = useViewportHighlighting(rootRef, lang)
  // Re-render when a lazy grammar finishes loading, so a fence that showed plain
  // text while its language's grammar imported picks up highlighting. The
  // snapshot value is opaque; only its change across renders drives the memo.
  const loaded = useSyncExternalStore(subscribeGrammarLoaded, grammarLoadCount, grammarLoadCount)
  // Streaming state lives in refs mutated inside the memo (the MarkdownText
  // streaming-cache pattern): the session's caches carry across chunks only
  // because the owner keys this instance stably while the fence grows.
  const sessionRef = useRef<StreamingHighlightSession | null>(null)
  const lineCacheRef = useRef<{
    code: string
    lang: string | undefined
    generation: number
    frame: StreamingHighlightFrame
    groups: ReactNode[]
    pending: ReactNode[]
    nextLine: number
    body: ReactNode
  } | null>(null)
  const settledRef = useRef(false)
  const streamedBody = useMemo(() => {
    if (!highlighting) {
      sessionRef.current = null
      lineCacheRef.current = null
      settledRef.current = false
      return undefined
    }
    if (streaming !== true) {
      const previous = lineCacheRef.current
      if (previous !== null && previous.code === trimmed && previous.lang === lang) {
        settledRef.current = true
        return previous.body
      }
      sessionRef.current = null
      lineCacheRef.current = null
      settledRef.current = true
      return undefined
    }
    if (settledRef.current) {
      sessionRef.current = null
      lineCacheRef.current = null
      settledRef.current = false
    }
    sessionRef.current ??= new StreamingHighlightSession()
    const frame = sessionRef.current.updateFrame(trimmed, lang)
    if (frame === undefined) {
      lineCacheRef.current = null
      return undefined
    }
    const previous = lineCacheRef.current
    if (previous?.frame === frame && previous.code === trimmed && previous.lang === lang) {
      return previous.body
    }
    const sameGeneration = previous?.generation === frame.generation
    const groups = sameGeneration ? [...previous.groups] : []
    let pending = sameGeneration ? [...previous.pending] : []
    let nextLine = sameGeneration ? previous.nextLine : 0
    for (const line of frame.appended) {
      pending.push(renderLine(line, nextLine))
      nextLine += 1
      if (pending.length !== STREAMING_LINE_GROUP_SIZE) continue
      const start = nextLine - pending.length
      groups.push(<Fragment key={start}>{pending}</Fragment>)
      pending = []
    }
    const tail = frame.tail.map((line, index) => renderLine(line, nextLine + index))
    const tailGroup = <Fragment key={nextLine - pending.length}>{[...pending, ...tail]}</Fragment>
    const body = <pre {...SHIKI_PRE_PROPS}><code>{groups}{tailGroup}</code></pre>
    lineCacheRef.current = {
      code: trimmed, lang, generation: frame.generation, frame, groups, pending, nextLine, body,
    }
    return body
  }, [streaming, highlighting, trimmed, lang, loaded])
  const html = useMemo(
    () => (highlighting && streaming !== true && streamedBody === undefined
      ? highlightToHtml(trimmed, lang)
      : undefined),
    [streaming, highlighting, streamedBody, trimmed, lang, loaded],
  )
  const [copied, setCopied] = useState(false)
  const [localWrapped, setWrapped] = useState(true)
  const wrapped = wrap ?? localWrapped
  const [fullscreen, setFullscreen] = useState(false)
  // Fullscreen is available for settled (non-streaming) blocks only.
  const canFullscreen = fullscreenLabel !== undefined && streaming !== true
  // Re-compute highlighted HTML for the fullscreen overlay; the inline `html`
  // may be undefined for blocks that were streamed and still hold a cached body.
  const fullscreenHtml = useMemo(
    () => (highlighting && streaming !== true ? highlightToHtml(trimmed, lang) : undefined),
    [highlighting, streaming, trimmed, lang, loaded],
  )

  // Body scroll lock and Escape dismiss for the fullscreen overlay.
  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [fullscreen])

  const onCopy = useCallback(() => {
    if (copied) return
    /* v8 ignore next -- both arms always mount a <pre>; trimmed is the
       typed fallback if the DOM shape ever diverges. */
    const text = rootRef.current?.querySelector('pre')?.textContent ?? trimmed
    void writeClipboard(text).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 1000)
    })
  }, [copied, trimmed])

  // shiki's HTML output is a static span tree it generated from `code` (no
  // user HTML passes through), the sanctioned innerHTML consumption path per
  // shiki's own docs.
  const body = streamedBody !== undefined
    ? streamedBody
    : html === undefined
      ? (
        <pre className={css.plain}><code>{sourceLines === undefined ? trimmed : sourceLines.map((line, index) => (
          <Fragment key={index}>{index > 0 && '\n'}<span className="line">{line}</span></Fragment>
        ))}</code></pre>
      )
      : (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )

  return (
    <div ref={rootRef} className={clsx(css.block, 'md-code-block', lineNumbers && css.numbered, toolbarLabels !== undefined && css.card, className)}
      data-line-numbers={lineNumbers || undefined}
      data-code-wrap={toolbarLabels === undefined ? undefined : wrapped}
      style={sourceLines === undefined ? undefined : {
        '--dsl-code-block-line-number-width': `${Math.max(2, String(sourceLines.length).length)}ch`,
      } as CSSProperties}>
      {/* These paired attributes are stable semantic hooks for owner styling and DOM tests. */}
      {showHeader && <div className={css.bannerWrap}>
        {toolbarLabels !== undefined ? <CodeToolbar
          lang={lang} labels={toolbarLabels} copyLabel={copyLabel} copiedLabel={copiedLabel}
          copied={copied} wrapped={wrapped} onCopy={onCopy}
          onWrap={wrap === undefined ? () => { setWrapped(value => !value) } : undefined}
          onFullscreen={canFullscreen ? () => { setFullscreen(true) } : undefined}
          fullscreenLabel={canFullscreen ? fullscreenLabel : undefined}
        /> : <div className={css.banner} data-code-block-banner>
          <div className={css.infostring}>{lang ?? ''}</div>
          <div className={css.action}>
            <button type="button" className={css.copyButton} onClick={onCopy}>
              {copied ? copiedLabel : copyLabel}
            </button>
            {canFullscreen && (
              <button type="button" className={css.copyButton} aria-label={fullscreenLabel} onClick={() => { setFullscreen(true) }}>
                <IconRightUpOutlineRegular size={14} />
              </button>
            )}
          </div>
        </div>}
      </div>}
      <div ref={contentRef} className={css.content} data-code-block-content>{body}</div>
      {fullscreen && createPortal(
        <div className={css.fullscreenBackdrop} role="dialog" aria-modal="true" aria-label={fullscreenLabel}>
          {/* Clicking the mask area behind the code panel dismisses the overlay,
              matching the ImageLightbox backdrop-tap pattern. */}
          <div className={css.fullscreenMask} aria-hidden="true" onMouseDown={() => { setFullscreen(false) }} />
          <div className={css.fullscreenStage}>
            <div className={css.fullscreenHeader}>
              <span className={css.infostring}>{lang ?? ''}</span>
              <div className={css.action}>
                <button type="button" className={css.copyButton} onClick={onCopy}>
                  {copied ? copiedLabel : copyLabel}
                </button>
                <button type="button" className={css.fullscreenClose} aria-label={fullscreenCloseLabel ?? fullscreenLabel ?? ''} onClick={() => { setFullscreen(false) }}>
                  <IconCloseOutlineRegular size={16} />
                </button>
              </div>
            </div>
            <div className={css.fullscreenBody}>
              {fullscreenHtml !== undefined
                ? (
                  /* shiki's HTML output is a static span tree — the sanctioned
                     innerHTML consumption path per shiki's own docs. */
                  <div dangerouslySetInnerHTML={{ __html: fullscreenHtml }} />
                )
                : (
                  <pre className={css.fullscreenPre}><code>
                    {sourceLines === undefined ? trimmed : sourceLines.map((line, index) => (
                      <Fragment key={index}>{index > 0 && '\n'}<span className="line">{line}</span></Fragment>
                    ))}
                  </code></pre>
                )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
