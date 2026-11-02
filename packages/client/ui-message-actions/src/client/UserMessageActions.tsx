/**
 * Per-message edit/delete actions with context-menu and inline-edit support.
 *
 * Desktop: right-click on the actions row shows a context menu.
 * Mobile: long-press (>500 ms) on the actions row shows the same menu.
 *
 * Selecting "Edit" replaces the icon buttons with an inline textarea.
 * Selecting "Delete" shows an inline confirmation bubble.
 * Both keep the user inside the conversation flow — no blocking modals.
 */
import { memo, useCallback, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { IconEditOutlineRegular, IconTrashOutlineRegular, MenuSurface, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-chat SlotMap merge (the user-actions hole).
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
// Type-only: pulls the LocaleNamespaceMap merge declared in locale.ts.
import type {} from './locale.ts'
import type { MessageEditStore } from './store.ts'
import { EditMessageInput } from './EditMessageInput.tsx'
import { DeleteConfirmBubble } from './DeleteConfirmBubble.tsx'
import css from './UserMessageActions.module.css'

/** Milliseconds before a touch is treated as long-press. */
const LONG_PRESS_MS = 500

/** Registrant-provided business callbacks for the entry. */
interface Injected {
  editMessage: (seq: number, text: string) => Promise<void>
  deleteMessage: (seq: number) => Promise<void>
}

/** Composed component props: owner data, store handle, injected callbacks, and locale seat. */
type Props = PropsRuntime<'conversation.chat.user-actions'>
  & PropsStore<MessageEditStore>
  & InjectFace<Injected>
  & PropsLocale<'message-actions'>

/**
 * Per-message edit/delete actions. Three visual modes:
 * 1. Normal: icon buttons with right-click/long-press context menu.
 * 2. Editing: inline textarea + Save/Cancel (replaces icon buttons).
 * 3. Deleting: inline confirmation bubble (replaces icon buttons).
 * @param props - Slot owner props, store handle, locale, and RPC callbacks.
 * @returns Action buttons, inline edit form, or delete confirmation.
 */
export const UserMessageActions = memo(function UserMessageActions({
  seq, text, useStore, actions, editMessage, deleteMessage, t,
}: Props) {
  const { editingMessageSeq, pendingDeleteSeq } = useStore(s => s)
  const { beginEdit, beginDelete, cancelEdit, cancelDelete, commitEdit, commitDelete } = actions
  const [submitting, setSubmitting] = useState(false)

  // ---- Context menu state ----
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuX, setMenuX] = useState(0)
  const [menuY, setMenuY] = useState(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const isEditing = editingMessageSeq === seq
  const isDeleting = pendingDeleteSeq === seq

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

  const handleDeleteCancel = useCallback(() => { cancelDelete() }, [cancelDelete])

  // ---- Context menu helpers ----
  const closeMenu = useCallback(() => { setMenuOpen(false) }, [])

  const openMenuAt = useCallback((x: number, y: number) => {
    setMenuX(x)
    setMenuY(y)
    setMenuOpen(true)
  }, [])

  // Desktop: right-click.
  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    openMenuAt(event.clientX, event.clientY)
  }, [openMenuAt])

  // Mobile: cancel any in-progress long-press timer.
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Mobile: start long-press timer.
  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0]
    if (touch == null) return
    longPressTimer.current = setTimeout(() => {
      openMenuAt(touch.clientX, touch.clientY)
    }, LONG_PRESS_MS)
  }, [openMenuAt])

  // Menu item selection.
  const onMenuSelect = useCallback((kind: 'edit' | 'delete') => {
    closeMenu()
    if (kind === 'edit') beginEdit(seq)
    else beginDelete(seq)
  }, [closeMenu, beginEdit, beginDelete, seq])

  // Escape closes the menu.
  const onWrapperKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && menuOpen) {
      event.stopPropagation()
      closeMenu()
    }
  }, [menuOpen, closeMenu])

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

  // ---- Render: normal mode with context menu ----
  return (
    <>
      <div
        ref={wrapperRef}
        className={css.wrapper}
        onContextMenu={onContextMenu}
        onTouchStart={onTouchStart}
        onTouchMove={cancelLongPress}
        onTouchEnd={cancelLongPress}
        onKeyDown={onWrapperKeyDown}
      >
        <Tooltip label={editLabel} side="bottom">
          <button type="button" className={css.action} aria-label={editLabel} onClick={handleEdit}>
            <IconEditOutlineRegular />
          </button>
        </Tooltip>
        <Tooltip label={deleteLabel} side="bottom">
          <button type="button" className={`${css.action} ${css.danger}`} aria-label={deleteLabel} onClick={handleDelete}>
            <IconTrashOutlineRegular />
          </button>
        </Tooltip>
      </div>
      {menuOpen && (
        <>
          <div
            className={css.backdrop}
            onClick={closeMenu}
            onContextMenu={(e) => { e.preventDefault(); closeMenu() }}
          />
          <MenuSurface compact className={css.menuSurface} style={{ left: menuX, top: menuY }} role="menu">
            <button type="button" className={css.menuItem} role="menuitem"
              onClick={() => { onMenuSelect('edit') }}>
              {editLabel}
            </button>
            <button type="button" className={css.menuItemDanger} role="menuitem"
              onClick={() => { onMenuSelect('delete') }}>
              {deleteLabel}
            </button>
          </MenuSurface>
        </>
      )}
    </>
  )
})