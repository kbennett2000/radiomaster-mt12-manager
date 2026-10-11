// Reading and writing the radio's own files: one file for each model, and its settings in radio.yml.
//
// The radio is strict about how these files are laid out. So a document keeps every line of a file
// exactly as it was read, and writing a document gives those same lines back, byte for byte.
// Beside the lines it keeps a tree built from them, which is only for looking things up. A change
// rebuilds one line and leaves every other line alone. Anything in a file that the app does not
// understand is carried through untouched.
//
// This reader is my own, written from the layout of real files. It is not a general reader for the
// format those files are written in: it knows the handful of shapes the radio writes, and refuses a
// file that has anything else, saying which line. It never repairs, drops or reorders a line.
//
// The layout:
//   - Every line ends with a carriage return and a line feed, the last line too.
//   - Each level is indented three spaces.
//   - "key: value" holds a value: a bare word or number, or text in double quotes.
//   - "key: " with deeper lines under it opens a group or a list. With nothing under it, it is a
//     value that is empty.
//   - "key:" with no space, such as "0:", opens a group. Groups inside a numbered group are
//     written this way, and so are some named ones in the radio's settings.
//   - " -", one space further in than its key, starts an item of a list. The item's fields
//     follow, one level further in than the key.

/** Why a file was refused. The plain words for each are in the strings file. */
export type RefusalReason =
  | 'notText'
  | 'empty'
  | 'lineEnding'
  | 'indent'
  | 'tooDeep'
  | 'notALine'
  | 'value'
  | 'repeatedKey'
  | 'dashOutsideList'
  | 'emptyItem'

/** A file that is not in the layout, and the first line that shows it, counted from 1. */
export interface Refusal {
  line: number
  reason: RefusalReason
}

/** "key: value". `text` is the value itself, without the double quotes when it has them. */
export interface ValueEntry {
  kind: 'value'
  key: string
  /** The line it is on, counted from 1. */
  line: number
  quoted: boolean
  text: string
}

/** "key: " with nothing after it and nothing under it. The file does not say what is missing. */
export interface EmptyEntry {
  kind: 'empty'
  key: string
  line: number
}

/** A key with keyed lines under it. */
export interface GroupEntry {
  kind: 'group'
  key: string
  line: number
  entries: readonly Entry[]
}

/** A key with list items under it. */
export interface ListEntry {
  kind: 'list'
  key: string
  line: number
  items: readonly Item[]
}

export type Entry = ValueEntry | EmptyEntry | GroupEntry | ListEntry

/** One item of a list: the line with its dash, and the fields under it. */
export interface Item {
  line: number
  entries: readonly Entry[]
}

/** Anything that holds keyed lines: a whole document, a group, or one item of a list. */
export interface Scope {
  readonly entries: readonly Entry[]
}

/** One of the radio's files, read. */
export interface Document extends Scope {
  /** Every line of the file exactly as read, in order, without its line ending. */
  readonly lines: readonly string[]
}

export type ReadResult = { ok: true; document: Document } | ({ ok: false } & Refusal)

const LINE_END = '\r\n'
const INDENT = 3

const KEY_LINE = /^( *)([A-Za-z0-9_]+):(.*)$/
const DASH_LINE = /^( *)-$/
// Text in double quotes. No real file has a double quote or a backslash inside the quotes, so
// the reader does not guess how the radio would write one. Nor may a tab or any other control
// character be in there.
const QUOTED = /^"[^"\\\p{Cc}]*"$/u
// A bare value: plain visible characters with no space, double quote, hash, colon or backslash.
const BARE = /^[!$-9;-[\]-~]+$/

/** One line, taken apart, before it has a place in the tree. */
type Piece =
  | { kind: 'dash'; line: number; level: number }
  | { kind: 'key'; line: number; level: number; key: string; value: { quoted: boolean; text: string } | null; spaced: boolean }

class Refused extends Error {
  readonly refusal: Refusal
  constructor(line: number, reason: RefusalReason) {
    super(reason)
    this.refusal = { line, reason }
  }
}

/** Splits the text into lines. Every line must end with a carriage return and a line feed. */
function linesOf(text: string): string[] {
  const lines: string[] = []
  let start = 0
  while (start < text.length) {
    const number = lines.length + 1
    const end = text.indexOf('\n', start)
    // The last line has no ending, or a line feed has no carriage return before it.
    if (end === -1 || end === start || text[end - 1] !== '\r') throw new Refused(number, 'lineEnding')
    const line = text.slice(start, end - 1)
    if (line.includes('\r')) throw new Refused(number, 'lineEnding')
    lines.push(line)
    start = end + 1
  }
  if (lines.length === 0) throw new Refused(1, 'empty')
  return lines
}

/** Takes one line apart, or refuses it. */
function pieceOf(text: string, line: number): Piece {
  const dash = DASH_LINE.exec(text)
  if (dash) {
    // A dash sits one space further in than the key of its list.
    if (dash[1].length % INDENT !== 1) throw new Refused(line, 'indent')
    return { kind: 'dash', line, level: (dash[1].length - 1) / INDENT }
  }
  const keyed = KEY_LINE.exec(text)
  if (!keyed) throw new Refused(line, 'notALine')
  const [, spaces, key, rest] = keyed
  if (spaces.length % INDENT !== 0) throw new Refused(line, 'indent')
  const level = spaces.length / INDENT
  if (rest === '') return { kind: 'key', line, level, key, value: null, spaced: false }
  if (rest === ' ') return { kind: 'key', line, level, key, value: null, spaced: true }
  // A value always has one space between it and the colon.
  if (rest[0] !== ' ') throw new Refused(line, 'notALine')
  const written = rest.slice(1)
  if (QUOTED.test(written)) return { kind: 'key', line, level, key, value: { quoted: true, text: written.slice(1, -1) }, spaced: true }
  if (BARE.test(written)) return { kind: 'key', line, level, key, value: { quoted: false, text: written }, spaced: true }
  throw new Refused(line, 'value')
}

/**
 * Builds the tree from the pieces. `from` is the first piece to read and `level` is how far in
 * its keys must be. It returns the entries it read and the first piece it left.
 */
function entriesFrom(pieces: readonly Piece[], from: number, level: number): { entries: Entry[]; next: number } {
  const entries: Entry[] = []
  const keys = new Set<string>()
  let at = from

  while (at < pieces.length) {
    const piece = pieces[at]
    if (piece.kind === 'dash') {
      // A dash further out starts the next item of a list these entries are inside.
      if (piece.level < level) break
      throw new Refused(piece.line, 'dashOutsideList')
    }
    if (piece.level < level) break
    if (piece.level > level) throw new Refused(piece.line, 'tooDeep')
    if (keys.has(piece.key)) throw new Refused(piece.line, 'repeatedKey')
    keys.add(piece.key)
    const { key, line } = piece

    if (piece.value) {
      entries.push({ kind: 'value', key, line, ...piece.value })
      at += 1
      continue
    }

    // Nothing after the colon. What it is depends on the line under it.
    const under = pieces[at + 1]
    if (under?.kind === 'dash' && under.level === level) {
      const items: Item[] = []
      at += 1
      while (at < pieces.length && pieces[at].kind === 'dash' && pieces[at].level === level) {
        const fields = entriesFrom(pieces, at + 1, level + 1)
        if (fields.entries.length === 0) throw new Refused(pieces[at].line, 'emptyItem')
        items.push({ line: pieces[at].line, entries: fields.entries })
        at = fields.next
      }
      entries.push({ kind: 'list', key, line, items })
    } else if (under?.kind === 'key' && under.level === level + 1) {
      const inside = entriesFrom(pieces, at + 1, level + 1)
      entries.push({ kind: 'group', key, line, entries: inside.entries })
      at = inside.next
    } else if (under && under.level > level) {
      // Deeper than one level, or a dash that is not directly under this key.
      throw new Refused(under.line, under.kind === 'dash' ? 'dashOutsideList' : 'tooDeep')
    } else {
      // Nothing under it. With a space after the colon it is a value that is empty. Without
      // one it can only be a group, so it is a group with nothing in it.
      entries.push(piece.spaced ? { kind: 'empty', key, line } : { kind: 'group', key, line, entries: [] })
      at += 1
    }
  }
  return { entries, next: at }
}

/** Reads a file's text. A file that is not in the layout is refused, with the line that shows it. */
export function readDocument(text: string): ReadResult {
  try {
    const lines = linesOf(text)
    const pieces = lines.map((line, index) => pieceOf(line, index + 1))
    const { entries, next } = entriesFrom(pieces, 0, 0)
    // Every line has a place by now. This is a guard in case that is ever not so.
    if (next < pieces.length) throw new Refused(pieces[next].line, 'notALine')
    return { ok: true, document: { lines, entries } }
  } catch (error) {
    if (error instanceof Refused) return { ok: false, ...error.refusal }
    throw error
  }
}

/** Writes a document as text: the lines it holds, each with the radio's line ending. */
export const writeDocument = (document: Document): string =>
  document.lines.map((line) => line + LINE_END).join('')

// Bytes and text. The radio's files are plain text, and every real one I have seen is ASCII.

export type TextResult = { ok: true; text: string } | ({ ok: false } & Refusal)

const LINE_FEED = 0x0a

/** A file's bytes as text. Bytes that are not text are refused, with the line they are on. */
export function textFromBytes(bytes: Uint8Array): TextResult {
  // Strict, and with nothing skipped, so that turning the text back into bytes gives these bytes.
  const decode = (part: Uint8Array) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(part)
  try {
    return { ok: true, text: decode(bytes) }
  } catch {
    // Find the first line that will not decode.
    let line = 1
    let start = 0
    while (start < bytes.length) {
      const feed = bytes.indexOf(LINE_FEED, start)
      const end = feed === -1 ? bytes.length : feed + 1
      try {
        decode(bytes.subarray(start, end))
      } catch {
        break
      }
      line += 1
      start = end
    }
    return { ok: false, line, reason: 'notText' }
  }
}

export const bytesFromText = (text: string): Uint8Array => new TextEncoder().encode(text)

/** Reads a file's bytes. */
export function documentFromBytes(bytes: Uint8Array): ReadResult {
  const text = textFromBytes(bytes)
  return text.ok ? readDocument(text.text) : text
}

/** Writes a document as the bytes of a file. */
export const bytesFromDocument = (document: Document): Uint8Array => bytesFromText(writeDocument(document))

// Lookups. A path names the keys to follow, joined by dots, such as "moduleData.0.subType". In a
// numbered group the number is the group's own. In a list it is the item's place, counted from 0.

/** True for a keyed line of the tree. A whole document and an item of a list are not one. */
const isEntry = (place: Scope | Entry | Item): place is Entry => 'kind' in place

function find(scope: Scope, path: string): Entry | Item | null {
  let at: Scope | Entry | Item = scope
  for (const step of path.split('.')) {
    if (isEntry(at) && at.kind === 'list') {
      const item: Item | undefined = /^\d+$/.test(step) ? at.items[Number(step)] : undefined
      if (!item) return null
      at = item
    } else if (!isEntry(at) || at.kind === 'group') {
      const entry: Entry | undefined = at.entries.find((candidate) => candidate.key === step)
      if (!entry) return null
      at = entry
    } else {
      // A value has nothing under it to step into.
      return null
    }
  }
  // The path has at least one step, so this is no longer the scope the search began in.
  return at as Entry | Item
}

/**
 * The value at a path, without its double quotes if it has them. An empty value gives "". Null
 * when nothing is there, or when what is there is a group or a list.
 */
export function valueAt(scope: Scope, path: string): string | null {
  const found = find(scope, path)
  if (!found || !isEntry(found)) return null
  if (found.kind === 'value') return found.text
  return found.kind === 'empty' ? '' : null
}

/** The items of the list at a path, in order. Null when what is there is not a list. */
export function itemsAt(scope: Scope, path: string): readonly Item[] | null {
  const found = find(scope, path)
  if (!found || !isEntry(found)) return null
  if (found.kind === 'list') return found.items
  return found.kind === 'empty' ? [] : null
}

/** One entry of a numbered group: its number, and the group written under that number. */
export interface NumberedEntry {
  number: number
  group: Scope
}

/**
 * The entries of the numbered group at a path, in the order they are written. The radio leaves
 * out numbers it has nothing to say about, so the numbers can skip. Null when what is there is
 * not a group.
 */
export function entriesAt(scope: Scope, path: string): readonly NumberedEntry[] | null {
  const found = find(scope, path)
  if (!found || !isEntry(found)) return null
  if (found.kind === 'empty') return []
  if (found.kind !== 'group') return null
  return found.entries.flatMap((entry) =>
    entry.kind === 'group' && /^\d+$/.test(entry.key) ? [{ number: Number(entry.key), group: entry }] : [],
  )
}

// The one kind of change: a new value on a line that is already there.

/** Why a value could not be set. */
export type EditProblem =
  /** No value is written at that path. The app never adds a line. */
  | 'noSuchValue'
  /** The layout cannot hold that text, quoted or bare, as the line is written. */
  | 'cannotBeWritten'

export type EditResult = { ok: true; document: Document } | { ok: false; problem: EditProblem }

// What may go between the double quotes: plain visible characters and spaces, with no double
// quote or backslash. What may be written bare is what the reader accepts as bare.
const WRITABLE_IN_QUOTES = /^[ !#-[\]-~]*$/

/**
 * A copy of the document with a new value at a path that already has one. Only that one line
 * changes. A quoted value stays quoted and a bare value stays bare.
 */
export function withValueAt(document: Document, path: string, text: string): EditResult {
  const found = find(document, path)
  if (!found || !isEntry(found) || (found.kind !== 'value' && found.kind !== 'empty')) {
    return { ok: false, problem: 'noSuchValue' }
  }
  const quoted = found.kind === 'value' && found.quoted
  if (!(quoted ? WRITABLE_IN_QUOTES : BARE).test(text)) return { ok: false, problem: 'cannotBeWritten' }

  const index = found.line - 1
  const before = document.lines[index]
  // Everything up to and including "key: " is kept as it is.
  const start = before.slice(0, before.indexOf(':') + 2)
  const lines = document.lines.with(index, start + (quoted ? `"${text}"` : text))
  // Read the result afresh, so the tree is rebuilt from the lines and can never drift from them.
  const reread = readDocument(lines.map((line) => line + LINE_END).join(''))
  return reread.ok ? { ok: true, document: reread.document } : { ok: false, problem: 'cannotBeWritten' }
}
