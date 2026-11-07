/**
 * Per-assistant-message edit/delete actions, seated in the TurnTail
 * MessageIconActions row alongside copy and branch controls.
 *
 * The component renders as compact icon buttons with Tooltip labels.
 * Selecting "Edit" opens an inline textarea through EditMessageInput.
 * Selecting "Delete" shows an inline confirmation bubble.
 * Both keep the user inside the conversation flow — no blocking modals.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { IconEditOutlineRegular, IconTrashOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-chat SlotMap merge (the assistant-actions hole).
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
// Type-only: pulls the LocaleNamespaceMap merge declared in locale.ts.
import type {} from './locale.ts'
import type { MessageEditStore } from './store.ts'
import { EditMessageInput } from './EditMessageInput.tsx'
import { DeleteConfirmBubble } from './DeleteConfirmBubble.tsx'
import css from './AssistantMessageActions.module.css'

/** Registrant-provided business callbacks for the entry. */
interface Injected {
  editMessage: (seq: number, text: string) => Promise<void>
  deleteMessage: (seq: number) => Promise<void>
}

/** Composed component props: owner data, store handle, injected callbacks, and locale seat. */
type Props = PropsRuntime<'conversation.chat.assistant-actions'>
  & PropsStore<MessageEditStore>
  & InjectFace<Injected>
  & PropsLocale<'message-actions'>

/**
 * Per-assistant-message edit/delete actions. Three visual modes:
 * 1. Normal: icon buttons with Tooltip labels.
 * 2. Editing: inline textarea + Save/Cancel (replaces icon buttons).
 * 3. Deleting: inline confirmation bubble (replaces icon buttons).
 * @param props - Slot owner props, store handle, locale, and RPC callbacks.
 * @returns Action buttons, inline edit form, or delete confirmation.
 */
export const AssistantMessageActions = memo(function AssistantMessageActions({
  seq, text, useStore, actions, editMessage, deleteMessage, t,
}: Props) {
  const { editingMessageSeq, pendingDeleteSeq } = useStore(s => s)
  const { beginEdit, beginDelete, cancelEdit, cancelDelete, commitEdit, commitDelete } = actions
  const [submitting, setSubmitting] = useState(false)

  const isEditing = editingMessageSeq === seq
  const isDeleting = pendingDeleteSeq === seq
  const deleteBtnRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const wasDeleting = useRef(false)
  useEffect(() => {
    if (wasDeleting.current && !isDeleting && restoreFocus.current && deleteBtnRef.current) {
      deleteBtnRef.current.focus()
      restoreFocus.current = false
    }
    wasDeleting.current = isDeleting
  }, [isDeleting])

  const handleEdit = useCallback(() => { beginEdit(seq) }, [beginEdit, seq])
  const handleDelete = useCallback(() => { beginDelete(seq) }, [beginDelete, seq])

  const handleEditSubmit = useCallback(async (newText: string) => {
    setSubmitting(true)
    try { await editMessage(seq, newText) } finally { setSubmitting(false) }
    commitEdit()
  }, [editMessage, seq, commitEdit])

  const handleEditCancel = useCallback(() => { cancelEdit() }, [cancelEdit])

  const handleDeleteConfirm = useCallback(async () => {
    setSubmitting(true)
    try { await deleteMessage(seq) } finally { setSubmitting(false) }
    commitDelete()
  }, [deleteMessage, seq, commitDelete])

  const handleDeleteCancel = useCallback(() => { restoreFocus.current = true; cancelDelete() }, [cancelDelete])

  if (text === '') return null

  const editLabel = t('message.edit')
  const deleteLabel = t('message.delete')

  // ---- Render: inline edit mode ----
  if (isEditing) {
    return (
      <EditMessageInput
        initialText={text}
        submitting={submitting}
        onSubmit={handleEditSubmit}
        onCancel={handleEditCancel}
        saveLabel={t('message.edit.save')}
        cancelLabel={t('message.edit.cancel')}
      />
    )
  }

  // ---- Render: inline delete confirmation ----
  if (isDeleting) {
    return (
      <DeleteConfirmBubble
        submitting={submitting}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmBody={t('message.delete.confirmBody')}
        cancelLabel={t('message.delete.cancel')}
        okLabel={t('message.delete.ok')}
      />
    )
  }

  // ---- Render: normal mode, icon buttons only ----
  return (
    <>
      <Tooltip label={editLabel} side="bottom">
        <button type="button" className={css.action} aria-label={editLabel} onClick={handleEdit}>
          <IconEditOutlineRegular />
        </button>
      </Tooltip>
      <Tooltip label={deleteLabel} side="bottom">
        <button type="button" ref={deleteBtnRef} className={`${css.action} ${css.danger}`} aria-label={deleteLabel} onClick={handleDelete}>
          <IconTrashOutlineRegular />
        </button>
      </Tooltip>
    </>
  )
})
