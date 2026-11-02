/** Inline textarea for editing a message in place, inside the actions row. */
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import css from './EditMessageInput.module.css'

interface EditMessageInputProps {
  /** Original message text pre-filled into the textarea. */
  initialText: string
  /** Whether a submission is in flight. */
  submitting: boolean
  /** Called with the trimmed text on save. */
  onSubmit: (text: string) => void
  /** Called on Escape or Cancel click. */
  onCancel: () => void
  /** Localized save button label. */
  saveLabel: string
  /** Localized cancel button label. */
  cancelLabel: string
}

/**
 * Inline edit textarea rendered inside the message's actions row, keeping
 * the user in the conversation flow. Ctrl/Cmd+Enter submits; Escape cancels.
 * No Modal wrapper — the textarea and buttons replace the action icons in place.
 * @param props - Original text, submission state, localized labels, and callbacks.
 * @returns The inline edit form.
 */
export const EditMessageInput = memo(function EditMessageInput({
  initialText, submitting, onSubmit, onCancel, saveLabel, cancelLabel,
}: EditMessageInputProps) {
  const [text, setText] = useState(initialText)
  const rows = Math.min(8, Math.max(2, initialText.split('\n').length))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (!submitting && text.trim() !== '') onSubmit(text.trim())
    }
    if (event.key === 'Escape') onCancel()
  }, [text, submitting, onSubmit, onCancel])

  return (
    <div className={css.inlineWrapper}>
      <textarea
        ref={textareaRef}
        className={css.editArea}
        value={text}
        onChange={(e) => { setText(e.target.value) }}
        onKeyDown={handleKeyDown}
        disabled={submitting}
        rows={rows}
      />
      <div className={css.inlineActions}>
        <button type="button" className={css.btn} disabled={submitting} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={`${css.btn} ${css.btnPrimary}`}
          disabled={submitting || text.trim() === ''}
          onClick={() => { onSubmit(text.trim()) }}>
          {saveLabel}
        </button>
      </div>
    </div>
  )
})