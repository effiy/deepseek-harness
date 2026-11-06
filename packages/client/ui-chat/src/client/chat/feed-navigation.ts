/**
 * Arrow-key navigation across one Chat feed's visible article rows.
 * The feed container owns the single Tab stop; the articles stay out of the
 * Tab order and receive focus only through this navigation, mirroring the
 * ARIA feed pattern where Up/Down arrows belong to the widget.
 */

/** Rows the arrow keys move focus between. */
const ARTICLE_SELECTOR = '[role="article"]'
/** Folded or folding rows the navigation must skip. */
const HIDDEN_SELECTOR = '[hidden], [data-chat-motion="collapse"]'
/** Widgets that own the arrow keys themselves; the feed must not steal them. */
const OWNER_SELECTOR = 'textarea, input, select, [contenteditable=""], [contenteditable="true"], '
  + '[role="menu"], [role="listbox"], [role="dialog"], [role="textbox"], [role="tree"], [role="grid"]'

/** Last article each feed held focus on, so a later Tab entry resumes there. */
const resumed = new WeakMap<HTMLElement, HTMLElement>()

/**
 * One feed's articles in DOM order, without folded or folding rows.
 * @param feed - container element carrying the feed role.
 * @returns the navigable article rows.
 */
export function feedArticles(feed: HTMLElement): HTMLElement[] {
  return [...feed.querySelectorAll<HTMLElement>(ARTICLE_SELECTOR)]
    .filter(article => article.closest(HIDDEN_SELECTOR) === null)
}

/**
 * Remember the article that received focus inside a feed so arrow navigation
 * resumes there after the reader tabs away and back.
 * @param feed - container element carrying the feed role.
 * @param target - focused element; a control inside an article counts as that article.
 */
export function rememberFeedFocus(feed: HTMLElement, target: EventTarget): void {
  if (!(target instanceof HTMLElement)) return
  const article = target.closest<HTMLElement>(ARTICLE_SELECTOR)
  if (article !== null && feed.contains(article)) resumed.set(feed, article)
}

/**
 * Move focus between articles on the arrow, Home, and End keys. A key owned
 * by an inner widget (input, menu, tree) or already consumed stays with that
 * widget; at both feed ends the key keeps its native scrolling behavior.
 * @param event - keydown event bubbled from the feed or its contents.
 * @param feed - container element carrying the feed role.
 */
export function navigateFeed(event: KeyboardEvent, feed: HTMLElement): void {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
  const { key } = event
  if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return
  const { target } = event
  if (!(target instanceof HTMLElement)) return
  if (target.closest(OWNER_SELECTOR) !== null) return
  const articles = feedArticles(feed)
  if (articles.length === 0) return
  const step = key === 'ArrowDown' ? 1 : -1
  const current = target.closest<HTMLElement>(ARTICLE_SELECTOR)
  let next: HTMLElement | undefined
  if (key === 'Home') next = articles[0]
  else if (key === 'End') next = articles[articles.length - 1]
  else if (current === null) {
    const remembered = resumed.get(feed)
    next = remembered !== undefined && articles.includes(remembered)
      ? remembered
      : (step === 1 ? articles[0] : articles[articles.length - 1])
  } else next = articles[articles.indexOf(current) + step]
  if (next === undefined) return
  event.preventDefault()
  next.focus()
}
