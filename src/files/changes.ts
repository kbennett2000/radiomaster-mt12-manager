// The list of file changes that turns one card into another.
//
// A change is "write these bytes to this path" or "remove this path". Whoever carries the list
// out does the changes in order. If they are stopped part way, by a pulled cable or a closed
// window, no model may be lost. Two rules give that:
//
//   1. Every write comes before any remove. A model that is moving is written to its new file
//      before its old file goes.
//   2. A write over a file that holds a model's only copy waits until that model has been
//      written somewhere else. When models swap round in a full circle, with no empty place to
//      begin from, there is nowhere to wait. Then the first of them is copied to a spare file
//      before anything is written over, and the spare is removed at the very end.
//
// The spare is kept where deleted models are kept, and named like one. So if the work does stop
// part way, the copy is not a stray file: it can be brought back like any deleted model.
//
// The radio's settings are written last of all the writes. They name the model the radio is set
// to, so they wait until that model's file is in its new place.

import { byPath, deletedPath, nextDeletedSerial, positionOfModelPath, RADIO_SETTINGS_PATH, type Card } from './card.ts'

export type Change = { kind: 'write'; path: string; bytes: Uint8Array } | { kind: 'remove'; path: string }

/** True when two runs of bytes are the same. */
export function sameBytes(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((byte, index) => byte === second[index])
}

/** A run of bytes as a key, so files with the same bytes can be found. Every byte gets its own character. */
const keyOf = (bytes: Uint8Array): string => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')

/** The card after a list of changes has been carried out, in order. */
export function applyChanges(card: Card, changes: readonly Change[]): Card {
  const next = new Map(card)
  for (const change of changes) {
    if (change.kind === 'write') next.set(change.path, change.bytes)
    else next.delete(change.path)
  }
  return next
}

/** The changes that turn the card `before` into the card `after`, in an order that is safe to stop in. */
export function changesBetween(before: Card, after: Card): Change[] {
  const writes: { path: string; bytes: Uint8Array }[] = []
  for (const [path, bytes] of after) {
    const old = before.get(path)
    if (!old || !sameBytes(old, bytes)) writes.push({ path, bytes })
  }
  // The settings go last. The other writes go in the order of their paths, so the list is the same every time.
  const settings = writes.filter((write) => write.path === RADIO_SETTINGS_PATH)
  const pending = writes.filter((write) => write.path !== RADIO_SETTINGS_PATH).toSorted(byPath)

  // Bytes that must still be on the card at the end, and how many files hold each right now.
  const wanted = new Set(Array.from(after.values(), keyOf))
  const held = new Map<string, number>()
  const hold = (key: string, by: number) => held.set(key, (held.get(key) ?? 0) + by)
  const now = new Map(before)
  for (const bytes of now.values()) hold(keyOf(bytes), 1)

  const changes: Change[] = []
  const spares: string[] = []
  function write(path: string, bytes: Uint8Array) {
    const over = now.get(path)
    if (over) hold(keyOf(over), -1)
    hold(keyOf(bytes), 1)
    now.set(path, bytes)
    changes.push({ kind: 'write', path, bytes })
  }
  /** True when writing over this path would not destroy the only copy of bytes that are still wanted. */
  function safeToWriteOver(path: string): boolean {
    const over = now.get(path)
    if (!over) return true
    const key = keyOf(over)
    return !wanted.has(key) || (held.get(key) ?? 0) > 1
  }

  while (pending.length > 0) {
    let next = pending.findIndex((candidate) => safeToWriteOver(candidate.path))
    if (next === -1) {
      // A full circle: every file still to be written over holds a model's only copy. Copy the
      // first to a spare file, which makes it safe to write over.
      const { path } = pending[0]
      const taken = [...now.keys(), ...after.keys()]
      const spare = deletedPath(nextDeletedSerial(taken), positionOfModelPath(path) ?? 1)
      write(spare, now.get(path)!)
      spares.push(spare)
      next = 0
    }
    const [{ path, bytes }] = pending.splice(next, 1)
    write(path, bytes)
  }
  for (const { path, bytes } of settings) write(path, bytes)

  const removed = Array.from(before.keys()).filter((path) => !after.has(path)).toSorted()
  for (const path of [...removed, ...spares]) changes.push({ kind: 'remove', path })
  return changes
}
