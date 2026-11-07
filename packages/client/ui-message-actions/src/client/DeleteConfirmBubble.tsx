/** Inline delete confirmation bubble that appears in the actions row. */
import { memo, useCallback, useEffect, useId, useRef } from 'react'
import css from './EditMessageInput.module.css'

interface DeleteConfirmBubbleProps {
  /** Whether a deletion request is in flight. */
  submitting: boolean
  /** Called on confirmation. */
  onConfirm: () => void
  /** Called on Escape or Cancel click. */
  onCancel: () => void
  /** Localized confirmation body text. */
  confirmBody: string
  /** Localized cancel button label. */
  cancelLabel: string
  /** Localized confirm/delete button label. */
  okLabel: string
}

/**
 * Inline delete confirmation rendered inside the actions row instead of a
 * blocking modal. The confirmation bubble keeps the conversation context
 * visible and the user oriented. Mounting moves focus to the cancel button,
 * so an accidental Enter cannot confirm the irreversible delete; Escape
 * cancels. Both buttons carry the confirmation body as their accessible
 * description, announced by screen readers when focus arrives.
 * @param props - Submission state, localized labels, and callbacks.
 * @returns The confirmation bubble.
 */
export const DeleteConfirmBubble = memo(function DeleteConfirmBubble({
  submitting, onConfirm, onCancel, confirmBody, cancelLabel, okLabel,
}: DeleteConfirmBubbleProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const bodyId = useId()

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onCancel()
  }, [onCancel])

  return (
    <div className={css.confirmBubble} onKeyDown={handleKeyDown}>
      <span id={bodyId} className={css.confirmText}>{confirmBody}</span>
      <div className={css.inlineActions}>
        <button ref={cancelRef} type="button" className={css.btn} disabled={submitting}
          aria-describedby={bodyId} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={`${css.btn} ${css.btnDanger}`}
          disabled={submitting} aria-describedby={bodyId} onClick={onConfirm}>
          {okLabel}
        </button>
      </div>
    </div>
  )
})
