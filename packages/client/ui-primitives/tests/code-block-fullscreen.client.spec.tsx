// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CodeBlock } from '../src/markdown/CodeBlock.tsx'

afterEach(cleanup)

const COPY_LABELS = { copyLabel: 'Copy', copiedLabel: 'Copied' }

describe('CodeBlock fullscreen', () => {
  it('renders an expand button when fullscreenLabel is set', () => {
    render(<CodeBlock code="plain" {...COPY_LABELS} fullscreenLabel="Fullscreen" />)
    expect(screen.getByLabelText('Fullscreen')).toBeTruthy()
  })

  it('does not render an expand button when fullscreenLabel is omitted', () => {
    render(<CodeBlock code="plain" {...COPY_LABELS} />)
    expect(screen.queryByLabelText('Fullscreen')).toBeNull()
  })

  it('opens a fullscreen dialog when the expand button is clicked', () => {
    render(<CodeBlock code="hello world" {...COPY_LABELS} fullscreenLabel="Fullscreen" />)
    fireEvent.click(screen.getByLabelText('Fullscreen'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    // Code content is duplicated in the overlay — verify the dialog contains it.
    expect(dialog.textContent).toContain('hello world')
  })

  it('closes the overlay when the close button is clicked', () => {
    render(<CodeBlock code="plain" {...COPY_LABELS} fullscreenLabel="F" fullscreenCloseLabel="Close" />)
    fireEvent.click(screen.getByLabelText('F'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the overlay on Escape', () => {
    render(<CodeBlock code="plain" {...COPY_LABELS} fullscreenLabel="F" />)
    fireEvent.click(screen.getByLabelText('F'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('locks body scroll during fullscreen', () => {
    render(<CodeBlock code="plain" {...COPY_LABELS} fullscreenLabel="F" />)
    fireEvent.click(screen.getByLabelText('F'))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    // After close, the body scroll is restored (previous value in jsdom is '').
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('does not show expand button for streaming blocks', () => {
    render(<CodeBlock code="x" lang="ts" streaming {...COPY_LABELS} fullscreenLabel="F" />)
    expect(screen.queryByLabelText('F')).toBeNull()
  })

  it('closes when the mask (backdrop area) is clicked', () => {
    render(<CodeBlock code="plain" {...COPY_LABELS} fullscreenLabel="F" />)
    fireEvent.click(screen.getByLabelText('F'))
    const dialog = screen.getByRole('dialog')
    const mask = dialog.firstElementChild
    if (!mask) throw new Error('mask missing')
    fireEvent.mouseDown(mask)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the expand button inside the CodeToolbar when toolbarLabels are set', () => {
    render(<CodeBlock code="plain" {...COPY_LABELS} toolbarLabels={{ codeLabel: 'Code', wrapLabel: 'Wrap', unwrapLabel: 'U' }} fullscreenLabel="F" />)
    expect(screen.getByLabelText('F')).toBeTruthy()
  })
})
