/**
 * Key definitions for the virtual keyboard.
 *
 * Every key has an `action` that maps to the component's dispatcher.
 * The `row` action separates rows; it is never rendered.
 */

export type KeyAction = 'char' | 'backspace' | 'enter' | 'shift' | 'layout' | 'hide' | 'row'

export type LayoutId = 'qwerty-lower' | 'qwerty-upper' | 'numbers' | 'symbols'

export interface KeyDef {
  /** Visible glyph. */
  label: string
  /** Inserted character (when action === 'char'). */
  value?: string
  /** Behaviour tag. */
  action: KeyAction
  /** Relative flex size within the row (default: 1). */
  flex?: number
  /** Target layout when action === 'layout'. */
  layout?: LayoutId
}

// ---------------------------------------------------------------------------
// Shared helper keys
// ---------------------------------------------------------------------------

const SHIFT: KeyDef    = { label: '\u21E7', action: 'shift', flex: 1.2 }
const BACKSPACE: KeyDef = { label: '\u232B', action: 'backspace', flex: 1.2 }
const NUMBERS: KeyDef   = { label: '123',  action: 'layout', layout: 'numbers', flex: 1.2 }
const LETTERS: KeyDef   = { label: 'ABC',  action: 'layout', layout: 'qwerty-lower', flex: 1.2 }
const SYMBOLS_TOGGLE: KeyDef = { label: '#+=', action: 'layout', layout: 'symbols', flex: 1.2 }
const SPACE: KeyDef     = { label: 'space', value: ' ', action: 'char', flex: 4.5 }
const ENTER: KeyDef     = { label: '\u21B5', action: 'enter', flex: 1.5 }
const DONE: KeyDef      = { label: '', action: 'hide', flex: 1.5 } // label filled at render time
const ROW: KeyDef       = { label: '', action: 'row' }

function comma(): KeyDef  { return { label: ',', value: ',', action: 'char' } }
function dot(): KeyDef    { return { label: '.', value: '.', action: 'char' } }

// Chars: one factory for each letter / digit / symbol.
function ch(label: string): KeyDef { return { label, value: label, action: 'char' } }

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

export const QWERTY_LOWER: readonly KeyDef[] = [
  ch('q'), ch('w'), ch('e'), ch('r'), ch('t'), ch('y'), ch('u'), ch('i'), ch('o'), ch('p'), ROW,
  ch('a'), ch('s'), ch('d'), ch('f'), ch('g'), ch('h'), ch('j'), ch('k'), ch('l'), ROW,
  SHIFT, ch('z'), ch('x'), ch('c'), ch('v'), ch('b'), ch('n'), ch('m'), BACKSPACE, ROW,
  NUMBERS, comma(), SPACE, dot(), ENTER,
]

export const QWERTY_UPPER: readonly KeyDef[] = [
  ch('Q'), ch('W'), ch('E'), ch('R'), ch('T'), ch('Y'), ch('U'), ch('I'), ch('O'), ch('P'), ROW,
  ch('A'), ch('S'), ch('D'), ch('F'), ch('G'), ch('H'), ch('J'), ch('K'), ch('L'), ROW,
  SHIFT, ch('Z'), ch('X'), ch('C'), ch('V'), ch('B'), ch('N'), ch('M'), BACKSPACE, ROW,
  NUMBERS, comma(), SPACE, dot(), ENTER,
]

export const NUMBERS: readonly KeyDef[] = [
  ch('1'), ch('2'), ch('3'), ch('4'), ch('5'), ch('6'), ch('7'), ch('8'), ch('9'), ch('0'), ROW,
  ch('-'), ch('/'), ch(':'), ch(';'), ch('('), ch(')'), ch('$'), ch('&'), ch('@'), ch('"'), ROW,
  SYMBOLS_TOGGLE, dot(), comma(), ch('?'), ch('!'), ch('\''), BACKSPACE, ROW,
  LETTERS, SPACE, ENTER,
]

export const SYMBOLS: readonly KeyDef[] = [
  ch('['), ch(']'), ch('{'), ch('}'), ch('#'), ch('%'), ch('^'), ch('*'), ch('+'), ch('='), ROW,
  ch('_'), ch('\\'), ch('|'), ch('~'), ch('<'), ch('>'), ch('\u20AC'), ch('\u00A3'), ch('\xA5'), ch('\u2022'), ROW,
  NUMBERS, dot(), comma(), ch('?'), ch('!'), ch('\''), BACKSPACE, ROW,
  LETTERS, SPACE, ENTER,
]