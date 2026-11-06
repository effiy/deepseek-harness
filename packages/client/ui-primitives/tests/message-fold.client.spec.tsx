// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MessageFold } from '../src/MessageFold.tsx'

afterEach(cleanup)

const LABELS = { expand: 'Show more', collapse: 'Show less' }

/** Tall block: 20 lines of text that will exceed the default 300px ceiling. */
function tallContent(lines = 20): string {
  return Array.from({ length: lines }, (_, i) => `Line ${i + 1}`).join('\n')
}

/** Short block: one line that fits within 300px. */
const shortContent = 'A short message'

/** Find the content container by locating the toggle button's parent wrapper,
 *  then reading its first child (the `.content` div). This avoids the
 *  text-node parentElement ambiguity that can arise with multi-line
 *  string children. */
function getCollapsedContent(): HTMLElement | null {
  const toggle = screen.getByText('Show more')
  const wrapper = toggle.parentElement
  if (!wrapper) return null
  return wrapper.firstElementChild as HTMLElement | null
}

describe('MessageFold', () => {
  it('clips content at the default maxHeight when collapsed', () => {
    render(<MessageFold labels={LABELS}>{tallContent()}</MessageFold>)
    const content = getCollapsedContent()
    if (!content) throw new Error('content missing')
    expect(content.style.maxHeight).toBe('300px')
  })

  it('shows the expand label when collapsed', () => {
    render(<MessageFold labels={LABELS}>{tallContent()}</MessageFold>)
    expect(screen.getByText('Show more')).toBeTruthy()
  })

  it('expands and removes the clip when toggled', () => {
    render(<MessageFold labels={LABELS}>{tallContent()}</MessageFold>)
    fireEvent.click(screen.getByText('Show more'))
    expect(screen.getByText('Show less')).toBeTruthy()
    // After expanding, the maxHeight inline style is absent.
    const toggle = screen.getByText('Show less')
    const wrapper = toggle.parentElement
    if (!wrapper) throw new Error('wrapper missing')
    const content = wrapper.firstElementChild as HTMLElement | null
    expect(content?.style.maxHeight).toBe('')
  })

  it('re-collapses and restores the clip when toggled again', () => {
    render(<MessageFold labels={LABELS}>{tallContent()}</MessageFold>)
    fireEvent.click(screen.getByText('Show more'))
    fireEvent.click(screen.getByText('Show less'))
    const content = getCollapsedContent()
    if (!content) throw new Error('content missing')
    expect(content.style.maxHeight).toBe('300px')
  })

  it('renders the gradient overlay when collapsed', () => {
    render(<MessageFold labels={LABELS}>{tallContent()}</MessageFold>)
    const toggle = screen.getByText('Show more')
    const wrapper = toggle.parentElement
    if (!wrapper) throw new Error('wrapper missing')
    // Collapsed: wrapper has content div + fade div + toggle button = 3 children.
    expect(wrapper.children.length).toBe(3)
  })

  it('hides the gradient when expanded', () => {
    render(<MessageFold labels={LABELS}>{tallContent()}</MessageFold>)
    fireEvent.click(screen.getByText('Show more'))
    // Expanded: wrapper has content div + toggle button = 2 children (no fade).
    const toggle = screen.getByText('Show less')
    const wrapper = toggle.parentElement
    if (!wrapper) throw new Error('wrapper missing')
    expect(wrapper.children.length).toBe(2)
  })

  it('respects a custom maxHeight', () => {
    render(<MessageFold maxHeight={200} labels={LABELS}>{tallContent()}</MessageFold>)
    // Query via the toggle button to reliably reach the content element.
    const toggle = screen.getByText('Show more')
    const wrapper = toggle.parentElement
    if (!wrapper) throw new Error('wrapper missing')
    const content = wrapper.firstElementChild as HTMLElement | null
    expect(content?.style.maxHeight).toBe('200px')
  })

  it('starts expanded when initiallyCollapsed is false', () => {
    render(<MessageFold labels={LABELS} initiallyCollapsed={false}>{tallContent()}</MessageFold>)
    expect(screen.getByText('Show less')).toBeTruthy()
  })

  it('still shows the toggle for short content (first-pass behavior)', () => {
    render(<MessageFold labels={LABELS}>{shortContent}</MessageFold>)
    // The toggle renders even when content fits; future enhancement may add
    // a measurement gate to skip the fold UI entirely.
    expect(screen.getByText('Show more')).toBeTruthy()
  })
})
