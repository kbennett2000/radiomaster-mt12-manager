// Saving to the radio's card: carrying out a list of file changes on a folder.
//
// This is the one place in the product that writes or removes a file in a folder a person picked.
// It is given the card the app holds and the changes to make, and it will not make them until four
// things are true, in this order:
//
//   1. The browser has said the app may change files in that folder. The app only ever asked to
//      read when it connected, so the browser asks the person now.
//   2. The card is what the app thinks it is. Every file the changes touch, and the radio's
//      settings, are read from the folder and have to match the card the app holds.
//   3. There is a backup. Before the first change after each Connect, the models, the deleted
//      models and the settings are copied into a new folder on the card, and read back.
//   4. Then the changes are made, one at a time, in the order they were given. That order is
//      already safe to stop in: see src/files/changes.ts.
//
// Afterwards every file that was written is read back, and the card is read afresh, so what the
// app holds next is what is really on the card.
//
// When a step fails, the work stops there and nothing is tidied up. Tidying up would be more
// writing to a card that has just refused a write. The order of the changes means no model is
// lost wherever it stops, and the backup is from before any of it.

import {
  DELETED_FOLDER,
  MODELS_FOLDER,
  RADIO_FOLDER,
  RADIO_SETTINGS_PATH,
  readCard,
  type Card,
  type CardReading,
} from '../files/card.ts'
import { sameBytes, type Change } from '../files/changes.ts'
import { readRadioFolder, type FileToRead, type FolderToRead } from './radioFolder.ts'

declare global {
  interface FileSystemHandle {
    /** Asks the browser, and through it the person, whether the app may change this file or folder. */
    requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
  }
}

/** A file's handle, as far as saving needs it: its bytes, and a way to put new ones in their place. */
export interface FileToChange extends FileToRead {
  createWritable(): Promise<{ write(data: Uint8Array<ArrayBuffer>): Promise<void>; close(): Promise<void> }>
}

/** A folder's handle, as far as saving needs it. */
export interface FolderToChange extends FolderToRead {
  entries(): AsyncIterable<[string, FolderToChange | FileToChange]>
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FolderToChange>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileToChange>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
}

/** How a save ended. Only the first leaves the card changed and whole. */
export type SaveResult =
  /** Every change was made and read back. `backup` is the folder made for it, or null when this Connect already had one. */
  | { ok: true; card: Card; reading: CardReading; backup: string | null }
  /** The browser, or the person, said the app may not change the files. Nothing was changed. */
  | { ok: false; problem: 'notAllowed' }
  /** The card is not what the app holds. Something else has changed it. Nothing was changed. */
  | { ok: false; problem: 'cardChanged' }
  /** The backup could not be made, or did not match when it was read back. Nothing else was changed. */
  | { ok: false; problem: 'backupFailed' }
  /** A change failed. The ones before it were made, and `stepsDone` says how many that was. */
  | { ok: false; problem: 'stoppedPartWay'; stepsDone: number }
  /** Every change was made, but what was read back is not what was written. `step` is the change it shows at, counted from 1. */
  | { ok: false; problem: 'wentWrong'; step: number }

export interface CardSaver {
  /**
   * Carries out a list of changes. `card` is the card the app holds, which the changes were worked
   * out from. Call this straight from the person's click: the browser only lets a page ask to
   * change files while a click is being handled.
   */
  save(card: Card, changes: readonly Change[]): Promise<SaveResult>
  /** Makes the next save take a backup first, as the first save after a Connect does. */
  startAfresh(): void
}

/** The folder on the card where the backups go, one folder inside it for each. */
export const BACKUPS_FOLDER = 'APP-BACKUPS'
/** How many backups are kept. Older ones are removed once a new one is safely made. */
export const BACKUPS_KEPT = 10

// A backup's folder is named for the date and time it was made, written so that names sort oldest
// first: 2026-10-11_14-03-27. A folder in APP-BACKUPS with a name of any other shape is not the
// app's, and is never touched.
const BACKUP_NAME = /^(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)-(\d\d)$/
const MODEL_FILE_NAME = /^model\d\d\.yml$/
const DELETED_PATH = `${MODELS_FOLDER}/${DELETED_FOLDER}`
// Where a change may be: a file in MODELS, in MODELS/DELETED or in RADIO, and nowhere else.
const CARD_PATH = new RegExp(`^(?:${MODELS_FOLDER}|${DELETED_PATH}|${RADIO_FOLDER})/[^/]+$`)

const twoDigits = (number: number): string => String(number).padStart(2, '0')

const nameFor = (time: Date): string =>
  `${time.getFullYear()}-${twoDigits(time.getMonth() + 1)}-${twoDigits(time.getDate())}` +
  `_${twoDigits(time.getHours())}-${twoDigits(time.getMinutes())}-${twoDigits(time.getSeconds())}`

/** The name one second after a backup's name. */
function oneSecondAfter(name: string): string {
  const [year, month, day, hour, minute, second] = BACKUP_NAME.exec(name)!.slice(1).map(Number)
  return nameFor(new Date(year, month - 1, day, hour, minute, second + 1))
}

/**
 * The name for a new backup. It is the time now, unless that would not sort after the newest
 * backup already there, which happens when the computer's clock has been put back. Then it is the
 * second after that newest one. So the names always sort in the order the backups were made, and
 * no two are ever the same.
 */
export function backupName(now: Date, namesThere: readonly string[]): string {
  const newest = namesThere.filter((name) => BACKUP_NAME.test(name)).toSorted().at(-1)
  let name = nameFor(now)
  if (newest !== undefined && name <= newest) name = oneSecondAfter(newest)
  while (namesThere.includes(name)) name = oneSecondAfter(name)
  return name
}

const isNotThere = (error: unknown): boolean => error instanceof DOMException && error.name === 'NotFoundError'

/** A path as the folders to go through and the file's own name. */
function parts(path: string): { folders: string[]; file: string } {
  const folders = path.split('/')
  const file = folders.pop()!
  return { folders, file }
}

/** The bytes of the file at a path, or null when there is no file there. It makes nothing. */
async function bytesAt(top: FolderToChange, path: string): Promise<Uint8Array | null> {
  const { folders, file } = parts(path)
  try {
    let folder = top
    for (const name of folders) folder = await folder.getDirectoryHandle(name)
    const found = await (await folder.getFileHandle(file)).getFile()
    return new Uint8Array(await found.arrayBuffer())
  } catch (error) {
    if (isNotThere(error)) return null
    throw error
  }
}

/** Writes a file. `mayMake` says which folders on the way may be made if they are not there. */
async function writeAt(top: FolderToChange, path: string, bytes: Uint8Array, mayMake: (name: string) => boolean): Promise<void> {
  const { folders, file } = parts(path)
  let folder = top
  for (const name of folders) folder = await folder.getDirectoryHandle(name, { create: mayMake(name) })
  const writing = await (await folder.getFileHandle(file, { create: true })).createWritable()
  await writing.write(new Uint8Array(bytes))
  await writing.close()
}

async function removeAt(top: FolderToChange, path: string): Promise<void> {
  const { folders, file } = parts(path)
  let folder = top
  for (const name of folders) folder = await folder.getDirectoryHandle(name)
  await folder.removeEntry(file)
}

/** The names in a folder, each with whether it is a folder itself. Empty when the folder is not there. */
async function namesIn(top: FolderToChange, path: string): Promise<Map<string, 'file' | 'directory'>> {
  const names = new Map<string, 'file' | 'directory'>()
  try {
    let folder = top
    for (const name of path.split('/')) folder = await folder.getDirectoryHandle(name)
    for await (const [name, entry] of folder.entries()) names.set(name, entry.kind)
  } catch (error) {
    if (!isNotThere(error)) throw error
  }
  return names
}

const filesIn = (names: ReadonlyMap<string, 'file' | 'directory'>): string[] =>
  Array.from(names).flatMap(([name, kind]) => (kind === 'file' ? [name] : []))

/**
 * Every file a backup holds: each model, each deleted model and the settings, as they are in the
 * folder right now. They are read from the folder and not taken from what the app holds, so the
 * backup is of the card itself.
 */
async function filesToBackUp(top: FolderToChange): Promise<Map<string, Uint8Array>> {
  const paths = [
    ...filesIn(await namesIn(top, MODELS_FOLDER))
      .filter((name) => MODEL_FILE_NAME.test(name))
      .map((name) => `${MODELS_FOLDER}/${name}`),
    ...filesIn(await namesIn(top, DELETED_PATH)).map((name) => `${DELETED_PATH}/${name}`),
    RADIO_SETTINGS_PATH,
  ]
  const files = new Map<string, Uint8Array>()
  for (const path of paths.toSorted()) {
    const bytes = await bytesAt(top, path)
    if (bytes === null) throw new Error(`${path} was there a moment ago and is not now`)
    files.set(path, bytes)
  }
  return files
}

/**
 * Makes a backup and gives its folder's name, or null when it could not be made or did not match
 * when read back. A backup that failed part way is removed again as far as it can be, so that a
 * broken one is never counted among the backups kept.
 */
async function backUp(top: FolderToChange, now: Date): Promise<string | null> {
  let made: string | null = null
  try {
    const files = await filesToBackUp(top)
    const name = backupName(now, Array.from((await namesIn(top, BACKUPS_FOLDER)).keys()))
    const backups = await top.getDirectoryHandle(BACKUPS_FOLDER, { create: true })
    await backups.getDirectoryHandle(name, { create: true })
    made = name

    const inBackup = (path: string): string => `${BACKUPS_FOLDER}/${name}/${path}`
    for (const [path, bytes] of files) await writeAt(top, inBackup(path), bytes, () => true)
    for (const [path, bytes] of files) {
      const copied = await bytesAt(top, inBackup(path))
      if (copied === null || !sameBytes(copied, bytes)) throw new Error(`the copy of ${path} does not match`)
    }
    return name
  } catch {
    if (made !== null) {
      try {
        await (await top.getDirectoryHandle(BACKUPS_FOLDER)).removeEntry(made, { recursive: true })
      } catch {
        // It could not be removed either. Nothing more is tried.
      }
    }
    return null
  }
}

/**
 * Removes the app's older backups, leaving the newest few. Only folders named the way the app
 * names a backup are looked at. If one cannot be removed it is left, and tried again another time.
 */
async function removeOlderBackups(top: FolderToChange): Promise<void> {
  try {
    const mine = Array.from(await namesIn(top, BACKUPS_FOLDER))
      .flatMap(([name, kind]) => (kind === 'directory' && BACKUP_NAME.test(name) ? [name] : []))
      .toSorted()
    const backups = await top.getDirectoryHandle(BACKUPS_FOLDER)
    for (const name of mine.slice(0, -BACKUPS_KEPT)) await backups.removeEntry(name, { recursive: true })
  } catch {
    // The backup that matters, the new one, is already made and checked.
  }
}

/**
 * A saver for one connected folder. It remembers whether it has made its backup, so there is one
 * backup for each Connect and not one for each change.
 */
export function cardSaver(folder: FolderToChange, now: () => Date = () => new Date()): CardSaver {
  let backedUp = false

  /** True when every file the changes touch, and the settings, are in the folder exactly as the app holds them. */
  async function cardIsAsHeld(card: Card, changes: readonly Change[]): Promise<boolean> {
    const paths = new Set([...changes.map((change) => change.path), RADIO_SETTINGS_PATH])
    try {
      for (const path of Array.from(paths).toSorted()) {
        const there = await bytesAt(folder, path)
        const held = card.get(path)
        if (there === null ? held !== undefined : held === undefined || !sameBytes(there, held)) return false
      }
      return true
    } catch {
      // A file that cannot be read is not a file the app can vouch for.
      return false
    }
  }

  /**
   * The number of the first change whose path is not as that change left it, counted from 1, or
   * null when every one is. A path that was written and later removed is checked as removed.
   */
  async function firstStepThatDidNotHold(changes: readonly Change[]): Promise<number | null> {
    for (const [index, change] of changes.entries()) {
      const isLastForItsPath = !changes.slice(index + 1).some((later) => later.path === change.path)
      if (!isLastForItsPath) continue
      try {
        const there = await bytesAt(folder, change.path)
        const held = change.kind === 'write' ? there !== null && sameBytes(there, change.bytes) : there === null
        if (!held) return index + 1
      } catch {
        return index + 1
      }
    }
    return null
  }

  async function save(card: Card, changes: readonly Change[]): Promise<SaveResult> {
    const outside = changes.find((change) => !CARD_PATH.test(change.path) || /\/\.\.?$/.test(change.path))
    if (outside) throw new RangeError(`${outside.path} is not a file the app may change`)
    // With nothing to change there is nothing to ask the browser for, and nothing to back up.
    if (changes.length === 0) return { ok: true, card, reading: readCard(card), backup: null }

    // 1. Permission. This is the first thing asked of the browser, so it is inside the person's click.
    let allowed: boolean
    try {
      allowed = (await folder.requestPermission({ mode: 'readwrite' })) === 'granted'
    } catch {
      allowed = false
    }
    if (!allowed) return { ok: false, problem: 'notAllowed' }

    // 2. The card must be what the app thinks it is.
    if (!(await cardIsAsHeld(card, changes))) return { ok: false, problem: 'cardChanged' }

    // 3. A backup, before the first change after each Connect.
    let backup: string | null = null
    if (!backedUp) {
      backup = await backUp(folder, now())
      if (backup === null) return { ok: false, problem: 'backupFailed' }
      backedUp = true
      await removeOlderBackups(folder)
    }

    // 4. The changes, in the order given. The first failure stops the work, and nothing is tidied up.
    for (const [index, change] of changes.entries()) {
      try {
        if (change.kind === 'write') await writeAt(folder, change.path, change.bytes, (name) => name === DELETED_FOLDER)
        else await removeAt(folder, change.path)
      } catch {
        return { ok: false, problem: 'stoppedPartWay', stepsDone: index }
      }
    }

    // 5. Read back what was written, and make sure what was removed is gone.
    const wrong = await firstStepThatDidNotHold(changes)
    if (wrong !== null) return { ok: false, problem: 'wentWrong', step: wrong }

    // 6. The card as it now is on the folder.
    const read = await readRadioFolder(folder)
    if (!read.ok) return { ok: false, problem: 'wentWrong', step: changes.length }
    return { ok: true, card: read.card, reading: read.reading, backup }
  }

  return {
    save,
    startAfresh: () => {
      backedUp = false
    },
  }
}
