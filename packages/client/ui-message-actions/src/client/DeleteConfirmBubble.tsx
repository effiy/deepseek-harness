/** Inline delete confirmation bubble that appears in the actions row. */
import { memo } from 'react'
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
 * visible and the user oriented.
 * @param props - Submission state, localized labels, and callbacks.
 * @returns The confirmation bubble.
 */
export const DeleteConfirmBubble = memo(function DeleteConfirmBubble({
  submitting, onConfirm, onCancel, confirmBody, cancelLabel, okLabel,
}: DeleteConfirmBubbleProps) {
  return (
    <div className={css.confirmBubble}>
      <span className={css.confirmText}>{confirmBody}</span>
      <div className={css.inlineActions}>
        <button type="button" className={css.btn} disabled={submitting} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={`${css.btn} ${css.btnDanger}`}
          disabled={submitting} onClick={onConfirm}>
          {okLabel}
        </button>
      </div>
    </div>
  )
})