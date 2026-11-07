// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeleteConfirmBubble } from '../src/client/DeleteConfirmBubble.tsx'

afterEach(cleanup)

const CONFIRM_BODY = '确定要删除这条消息吗？此操作不可撤销。'

/** Renders the bubble with spy callbacks and localized zh labels; returns the props for assertions. */
function renderBubble(overrides: Partial<React.ComponentProps<typeof DeleteConfirmBubble>> = {}) {
  const props = {
    submitting: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    confirmBody: CONFIRM_BODY,
    cancelLabel: '取消',
    okLabel: '删除',
    ...overrides,
  }
  render(<DeleteConfirmBubble {...props} />)
  return props
}

describe('DeleteConfirmBubble', () => {
  it('focuses the cancel button on mount so an accidental Enter cannot confirm', () => {
    renderBubble()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' }))
  })

  it('describes both buttons with the confirmation body for screen readers', () => {
    renderBubble()
    const bodyId = screen.getByText(CONFIRM_BODY).id
    expect(bodyId).not.toBe('')
    expect(screen.getByRole('button', { name: '取消' }).getAttribute('aria-describedby')).toBe(bodyId)
    expect(screen.getByRole('button', { name: '删除' }).getAttribute('aria-describedby')).toBe(bodyId)
  })

  it('Escape cancels without confirming', () => {
    const props = renderBubble()
    fireEvent.keyDown(screen.getByRole('button', { name: '取消' }), { key: 'Escape' })
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).not.toHaveBeenCalled()
  })

  it('keys other than Escape do not cancel', () => {
    const props = renderBubble()
    fireEvent.keyDown(screen.getByRole('button', { name: '取消' }), { key: 'Tab' })
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('cancel and confirm buttons call their own callbacks', () => {
    const props = renderBubble()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons while a deletion is in flight', () => {
    renderBubble({ submitting: true })
    expect(screen.getByRole('button', { name: '取消' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: '删除' })).toHaveProperty('disabled', true)
  })
})
