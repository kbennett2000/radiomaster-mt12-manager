// The list of file changes that turns one card into another.
//
// A change is "write these bytes to this path" or "remove this path". Whoever carries the list
// out does the changes in order. If they are stopped part way, by a pulled cable or a closed
// window, no model may be lost, and the radio may not be left set to the wrong model. Three rules
// give that:
//
//   1. Every write comes before any remove. A model that is moving is written to its new file
//      before its old file goes.
//   2. A write over a file that holds a model's only copy waits until that model has been
//      written somewhere else. When models swap round in a full circle, with no empty place to
//      begin from, there is nowhere to wait. Then the first of them is copied to a spare file
//      before anything is written over, and the spare is removed at the very end.
//   3. The radio's settings name the model the radio is set to by its file. They are written as
//      soon as the file they are going to name holds its model. Until they are, the file they
//      name now is not written over. So wherever the work stops, the settings name a file that
//      holds the model the radio was set to, or the one it is being set to.
//
// The spare is kept where deleted models are kept, and named like one. So if the work does stop
// part way, the copy is not a stray file: it can be brought back like any deleted model.

import {
  byPath,
  deletedPath,
  modelPath,
  nextDeletedSerial,
  PLACES,
  positionOfModelPath,
  RADIO_SETTINGS_PATH,
  type Card,
} from './card.ts'
import { documentFromBytes } from './document.ts'
import { currentModelNumberOf } from './radioSettings.ts'

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

/**
 * The model file a settings file names, which is the model the radio is set to. Null when the
 * settings are missing, cannot be read, or name none of the radio's places.
 */
function fileNamedBy(settings: Uint8Array | undefined): string | null {
  const read = settings ? documentFromBytes(settings) : null
  const number = read?.ok ? currentModelNumberOf(read.document) : null
  return number !== null && number < PLACES ? modelPath(number + 1) : null
}

/** The changes that turn the card `before` into the card `after`, in an order that is safe to stop in. */
export function changesBetween(before: Card, after: Card): Change[] {
  const writes: { path: string; bytes: Uint8Array }[] = []
  for (const [path, bytes] of after) {
    const old = before.get(path)
    if (!old || !sameBytes(old, bytes)) writes.push({ path, bytes })
  }
  // The settings have a time of their own, below. The other writes go in the order of their
  // paths, so the list is the same every time.
  const settings = writes.find((write) => write.path === RADIO_SETTINGS_PATH)
  const pending = writes.filter((write) => write.path !== RADIO_SETTINGS_PATH).toSorted(byPath)
  // The file the settings name now, and the file they are going to name.
  const named = fileNamedBy(before.get(RADIO_SETTINGS_PATH))
  const toName = settings ? fileNamedBy(settings.bytes) : null

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

  let settingsToWrite = settings !== undefined
  /** Writes the settings once the file they are going to name holds what it will hold at the end. */
  function writeSettingsIfTheirModelIsThere() {
    if (!settings || !settingsToWrite) return
    const there = toName === null ? undefined : now.get(toName)
    const atTheEnd = toName === null ? undefined : after.get(toName)
    if (atTheEnd && !(there && sameBytes(there, atTheEnd))) return
    write(settings.path, settings.bytes)
    settingsToWrite = false
  }
  /** True for the file the settings still name. It is not written over until the settings name another. */
  const heldForSettings = (path: string): boolean => settingsToWrite && path === named && named !== toName

  writeSettingsIfTheirModelIsThere()
  while (pending.length > 0) {
    // While a file is held for the settings, the file the settings are going to name is still to
    // be written and is not held, so there is always a write that is free to go.
    const free = pending.filter((candidate) => !heldForSettings(candidate.path))
    let next = free.find((candidate) => safeToWriteOver(candidate.path))
    if (!next) {
      // Every file that is free to be written over holds a model's only copy: a full circle, or a
      // chain that begins at the file held for the settings. Copy the first to a spare file,
      // which makes it safe to write over.
      next = free[0]
      const taken = [...now.keys(), ...after.keys()]
      const spare = deletedPath(nextDeletedSerial(taken), positionOfModelPath(next.path) ?? 1)
      write(spare, now.get(next.path)!)
      spares.push(spare)
    }
    pending.splice(pending.indexOf(next), 1)
    write(next.path, next.bytes)
    writeSettingsIfTheirModelIsThere()
  }

  const removed = Array.from(before.keys()).filter((path) => !after.has(path)).toSorted()
  for (const path of [...removed, ...spares]) changes.push({ kind: 'remove', path })
  return changes
}
