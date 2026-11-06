// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { feedArticles, navigateFeed, rememberFeedFocus } from '../src/client/chat/feed-navigation.ts'

const ARTICLE = '<div role="article" tabindex="-1"></div>'

/** Build a feed wired the way ChatView wires it: keydown navigates, focusin remembers. */
function mountFeed(markup: string): HTMLElement {
  const feed = document.createElement('div')
  feed.setAttribute('role', 'feed')
  feed.tabIndex = 0
  feed.innerHTML = markup
  document.body.append(feed)
  feed.addEventListener('keydown', (event) => { navigateFeed(event, feed) })
  feed.addEventListener('focusin', (event) => { rememberFeedFocus(feed, event.target ?? feed) })
  return feed
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function rows(feed: HTMLElement): HTMLElement[] {
  return [...feed.querySelectorAll<HTMLElement>('[role="article"]')]
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('feedArticles', () => {
  it('keeps DOM order and skips rows folded away or mid-collapse', () => {
    const feed = mountFeed(
      ARTICLE
      + '<div role="article" tabindex="-1" hidden></div>'
      + '<div hidden><div role="article" tabindex="-1"></div></div>'
      + '<div data-chat-motion="collapse"><div role="article" tabindex="-1"></div></div>'
      + ARTICLE,
    )
    const all = rows(feed)
    expect(all).toHaveLength(5)
    expect(feedArticles(feed)).toEqual([all[0], all[4]])
  })
})

describe('navigateFeed', () => {
  it('enters from the top on ArrowDown and from the bottom on ArrowUp while no row held focus', () => {
    const feed = mountFeed(ARTICLE + ARTICLE + ARTICLE)
    feed.focus()
    press(feed, 'ArrowDown')
    expect(document.activeElement).toBe(rows(feed)[0])

    const fresh = mountFeed(ARTICLE + ARTICLE + ARTICLE)
    fresh.focus()
    press(fresh, 'ArrowUp')
    expect(document.activeElement).toBe(rows(fresh)[2])
  })

  it('steps between rows and leaves a row from a control inside it', () => {
    const feed = mountFeed(
      ARTICLE + '<div role="article" tabindex="-1"><button type="button">copy</button></div>' + ARTICLE,
    )
    const [first, second, third] = rows(feed)
    first!.focus()
    press(first!, 'ArrowDown')
    expect(document.activeElement).toBe(second)
    const control = second!.querySelector('button')!
    control.focus()
    press(control, 'ArrowDown')
    expect(document.activeElement).toBe(third)
    press(third!, 'ArrowUp')
    expect(document.activeElement).toBe(second)
  })

  it('leaves both ends to the native scrolling behavior', () => {
    const feed = mountFeed(ARTICLE + ARTICLE)
    const [first, second] = rows(feed)
    first!.focus()
    expect(press(first!, 'ArrowUp').defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(first)
    second!.focus()
    expect(press(second!, 'ArrowDown').defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(second)
  })

  it('jumps to the ends with Home and End', () => {
    const feed = mountFeed(ARTICLE + ARTICLE + ARTICLE)
    const [first, , third] = rows(feed)
    first!.focus()
    press(first!, 'End')
    expect(document.activeElement).toBe(third)
    press(third!, 'Home')
    expect(document.activeElement).toBe(first)
  })

  it('resumes at the last row that held focus and falls back once it is gone', () => {
    const feed = mountFeed(ARTICLE + ARTICLE + ARTICLE)
    const [first, second] = rows(feed)
    second!.focus()
    feed.focus()
    press(feed, 'ArrowDown')
    expect(document.activeElement).toBe(second)
    second!.remove()
    feed.focus()
    press(feed, 'ArrowDown')
    expect(document.activeElement).toBe(first)
  })

  it('leaves keys to inner widgets, modifier chords, consumed events, and foreign keys', () => {
    const feed = mountFeed(
      '<div role="article" tabindex="-1"><textarea></textarea>'
      + '<div role="menu"><button type="button">item</button></div></div>'
      + ARTICLE,
    )
    const textarea = feed.querySelector('textarea')!
    textarea.focus()
    expect(press(textarea, 'ArrowDown').defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(textarea)
    const item = feed.querySelector<HTMLButtonElement>('[role="menu"] button')!
    item.focus()
    press(item, 'ArrowDown')
    expect(document.activeElement).toBe(item)

    feed.focus()
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
      press(feed, 'ArrowDown', init)
      expect(document.activeElement).toBe(feed)
    }
    const consumed = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    consumed.preventDefault()
    feed.dispatchEvent(consumed)
    expect(document.activeElement).toBe(feed)
    press(feed, 'PageDown')
    expect(document.activeElement).toBe(feed)
  })

  it('ignores a feed without rows and a keydown from outside the element world', () => {
    const empty = mountFeed('<p>loading…</p>')
    empty.focus()
    expect(press(empty, 'ArrowDown').defaultPrevented).toBe(false)

    const feed = mountFeed(ARTICLE)
    const text = document.createTextNode('label')
    rows(feed)[0]!.append(text)
    press(text, 'ArrowDown')
    expect(document.activeElement).not.toBe(rows(feed)[0])
  })
})

describe('rememberFeedFocus', () => {
  it('records only articles that belong to the feed, from the row or a control inside it', () => {
    const feed = mountFeed(ARTICLE + ARTICLE)
    const [first, second] = rows(feed)
    const elsewhere = mountFeed(ARTICLE)
    second!.focus()
    // A foreign article, a bare text node, and the feed itself never overwrite the memory.
    rememberFeedFocus(feed, rows(elsewhere)[0]!)
    rememberFeedFocus(feed, document.createTextNode('x'))
    rememberFeedFocus(feed, feed)
    feed.focus()
    press(feed, 'ArrowDown')
    expect(document.activeElement).toBe(second)
    // A control inside a row remembers that row.
    first!.focus()
    feed.focus()
    press(feed, 'ArrowDown')
    expect(document.activeElement).toBe(first)
  })
})
