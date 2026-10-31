/** Per-message edit and delete state, shared across the session via a declarative store handle. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** Store shape: which message is being edited or has a pending delete confirmation. */
interface EditState {
  editingMessageSeq: number | null
  pendingDeleteSeq: number | null
}

/** Action write set over the edit/delete state. */
type EditActions = {
  beginEdit: (draft: EditState, seq: number) => void
  cancelEdit: (draft: EditState) => void
  beginDelete: (draft: EditState, seq: number) => void
  cancelDelete: (draft: EditState) => void
  commitEdit: (draft: EditState) => void
  commitDelete: (draft: EditState) => void
}

export type MessageEditStore = ReturnType<typeof createMessageEditStore>

/**
 * Declare the per-message edit/delete store. Each session instance holds one
 * editing message and one pending-delete message. The framework owns the live
 * instance; the component receives the selector hook and baked actions through
 * {@link PropsStore}.
 * @returns a store handle.
 */
export function createMessageEditStore(): EngineStoreHandle<EditState, EditActions> {
  return defineStore({
    init: (): EditState => ({
      editingMessageSeq: null,
      pendingDeleteSeq: null,
    }),
    actions: {
      /** Open the inline edit form for the given message. */
      beginEdit: (draft, seq) => { draft.editingMessageSeq = seq },
      /** Close the inline edit form without saving. */
      cancelEdit: (draft) => { draft.editingMessageSeq = null },
      /** Open the delete confirmation bubble for the given message. */
      beginDelete: (draft, seq) => { draft.pendingDeleteSeq = seq },
      /** Close the delete confirmation bubble without confirming. */
      cancelDelete: (draft) => { draft.pendingDeleteSeq = null },
      /** Close the inline edit form after a successful save. */
      commitEdit: (draft) => { draft.editingMessageSeq = null },
      /** Close the delete confirmation bubble after a successful deletion. */
      commitDelete: (draft) => { draft.pendingDeleteSeq = null },
    },
  })
}