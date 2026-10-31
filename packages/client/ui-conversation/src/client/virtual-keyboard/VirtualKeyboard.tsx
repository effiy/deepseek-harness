/**
 * Virtual keyboard: QWERTY / numbers / symbols layouts with direct
 * Lexical insertion.  Rendered inside the composer seat so it extends
 * the footer naturally through flex layout — no fixed positioning.
 *
 * Phase 2 additions: staggered QWERTY row indentation and shift-key
 * visual states (active/inactive).
 *
 * @module virtual-keyboard
 */
import { useState, useCallback, useMemo } from 'react'
import type { LexicalEditor } from 'lexical'
import { $getSelection, $isRangeSelection, DELETE_CHARACTER_COMMAND, INSERT_LINE_BREAK_COMMAND } from 'lexical'
import type { KeyAction } from './layouts.ts'
import { QWERTY_LOWER, QWERTY_UPPER, NUMBERS, SYMBOLS, type KeyDef, type LayoutId } from './layouts.ts'
import css from './VirtualKeyboard.module.css'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VirtualKeyboardProps {
  /** The borrowed Lexical editor; null when no session is active. */
  editor: LexicalEditor | null
  /** Whether the keyboard is currently open. */
  visible: boolean
  /** Localised label for the “done” / hide button. */
  doneLabel: string
  /** Localised label for the space bar. */
  spaceLabel: string
  /** Called when the user taps Done or otherwise dismisses the keyboard. */
  onHide: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VirtualKeyboard({ editor, visible, doneLabel, spaceLabel, onHide }: VirtualKeyboardProps) {
  const [layoutId, setLayoutId] = useState<LayoutId>('qwerty-lower')

  // ── layout lookup ──────────────────────────────────────────────────────
  const layout: readonly KeyDef[] = useMemo(() => {
    const base: readonly KeyDef[] = (() => {
      switch (layoutId) {
        case 'qwerty-upper': return QWERTY_UPPER
        case 'numbers':      return NUMBERS
        case 'symbols':      return SYMBOLS
        default:             return QWERTY_LOWER
      }
    })()
    // Override the space-bar label with the localised string.
    return base.map(key => (key.value === ' ' && key.action === 'char' ? { ...key, label: spaceLabel } : key))
  }, [layoutId, spaceLabel])

  // ── Lexical helpers ────────────────────────────────────────────────────
  const insertChar = useCallback((char: string) => {
    if (editor === null) return
    // Focus the editor so the caret is visible and the range selection
    // resolves.  The contentEditable's readOnly attribute (set on mobile)
    // prevents the system soft-keyboard from appearing.
    editor.focus()
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) selection.insertText(char)
    })
    navigator.vibrate?.(5)
  }, [editor])

  const handleBackspace = useCallback(() => {
    if (editor === null) return
    editor.focus()
    editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true)
    navigator.vibrate?.(5)
  }, [editor])

  const handleEnter = useCallback(() => {
    if (editor === null) return
    editor.focus()
    editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, undefined)
    navigator.vibrate?.(5)
  }, [editor])

  // ── key dispatcher ─────────────────────────────────────────────────────
  const handleKey = useCallback((key: KeyDef) => {
    switch (key.action) {
      case 'char':
        insertChar(key.value ?? key.label)
        // Auto-release shift after one tap (WeChat-style).
        if (layoutId === 'qwerty-upper') setLayoutId('qwerty-lower')
        break
      case 'backspace':
        handleBackspace()
        break
      case 'enter':
        handleEnter()
        break
      case 'shift':
        setLayoutId(id => id === 'qwerty-lower' ? 'qwerty-upper' : 'qwerty-lower')
        navigator.vibrate?.(5)
        break
      case 'layout':
        setLayoutId(key.layout!)
        navigator.vibrate?.(5)
        break
      case 'hide':
        navigator.vibrate?.(5)
        onHide()
        break
    }
  }, [insertChar, handleBackspace, handleEnter, layoutId, onHide])

  // ── render ─────────────────────────────────────────────────────────────
  if (!visible || editor === null) return null

  const rows = groupIntoRows(layout)

  return (
    <div className={css.root} data-virtual-keyboard="" data-layout={layoutId} role="group" aria-label="Virtual keyboard">
      {/* Optional top-bar with the Done button */}
      <div className={css.topBar}>
        <button type="button" className={css.doneButton} onClick={onHide}>
          {doneLabel}
        </button>
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className={css.row}>
          {row.map((key, ki) => {
            const label = key.label
            const isSpecial = key.action !== 'char'
            const flex = key.flex ?? 1
            return (
              <button
                key={ki}
                type="button"
                className={`${css.key} ${isSpecial ? css.keySpecial : ''} ${key.action === 'hide' ? css.keyDone : ''}`}
                style={{ flex }}
                onMouseDown={(e) => { e.preventDefault() }}
                onClick={() => { handleKey(key) }}
                {...(key.action === 'shift' ? { 'data-shift-state': layoutId === 'qwerty-upper' ? 'active' : 'inactive' } : {})}
              >
                <span className={css.keyLabel}>{label}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Chunk a flat layout into rows on the `row` separator. */
function groupIntoRows(layout: readonly KeyDef[]): KeyDef[][] {
  const rows: KeyDef[][] = []
  let current: KeyDef[] = []
  for (const key of layout) {
    if (key.action === 'row') { rows.push(current); current = [] }
    else current.push(key)
  }
  if (current.length > 0) rows.push(current)
  return rows
}