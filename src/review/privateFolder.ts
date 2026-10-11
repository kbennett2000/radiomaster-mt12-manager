// For reviewers only, and not part of the product: a made-up card, put where the browser can hand
// the app a folder without the folder picker.
//
// The browser keeps a private storage for each site, which no other site and no other program can
// see. A reviewer's link writes one of the made-up cards there and gives back that folder's handle.
// The app then reads it with the same code that reads a folder a person picked. This file writes
// the made-up card there, and it can only write into that private storage. A folder a person
// picked is written by src/platform/saveToFolder.ts and by nothing else.

import { RADIO_SETTINGS_PATH } from '../files/card.ts'
import { withCurrentModelNumber } from '../files/radioSettings.ts'
import { connectTo, type CardConnection } from '../platform/cardConnection.ts'
import { readRadioFolder } from '../platform/radioFolder.ts'
import { BACKUPS_FOLDER, type FileToChange, type FolderToChange, type SaveResult } from '../platform/saveToFolder.ts'
import type { ReviewCard } from '../state/scenarios.ts'
import { nextSave, type NextSave } from './nextSave.ts'
import { reviewCard } from './reviewCards.ts'

const folders = new Map<ReviewCard, Promise<FileSystemDirectoryHandle>>()

async function fill(card: ReviewCard): Promise<FileSystemDirectoryHandle> {
  const storage = await navigator.storage.getDirectory()
  const name = `review-card-${card}`
  // Start from nothing each time, so a card from an earlier visit cannot show through.
  await storage.removeEntry(name, { recursive: true }).catch(() => undefined)
  const top = await storage.getDirectoryHandle(name, { create: true })

  for (const [path, bytes] of reviewCard(card)) {
    const folderNames = path.split('/')
    const fileName = folderNames.pop()!
    let folder = top
    for (const folderName of folderNames) folder = await folder.getDirectoryHandle(folderName, { create: true })
    const file = await folder.getFileHandle(fileName, { create: true })
    const writing = await file.createWritable()
    await writing.write(new Uint8Array(bytes))
    await writing.close()
  }
  return top
}

/** A folder in the browser's private storage holding one of the made-up cards. It is filled once per page. */
export function privateFolderWith(card: ReviewCard): Promise<FileSystemDirectoryHandle> {
  let folder = folders.get(card)
  if (!folder) {
    folder = fill(card)
    folders.set(card, folder)
  }
  return folder
}

/** How the folder should misbehave during the save that is running now. */
interface Fault {
  way: NextSave | null
  /** Which write to the card should fail, counted from 1, when the save is to stop part way. */
  failWrite: number
  /** How many writes to the card this save has started. */
  writes: number
}

const madeToFail = (what: string): Error => new Error(`${what} was made to fail by the reviewer's switch`)

/**
 * A folder in private storage that does what a real one does, except for the one thing the
 * reviewer's switch has asked to go wrong. The app's own saving code is given this folder and
 * runs as it always does, so what it reports is what it would report for a real failure.
 */
function misbehaving(folder: FileSystemDirectoryHandle, fault: Fault, path = ''): FolderToChange {
  const fileFor = (file: FileSystemFileHandle): FileToChange => ({
    kind: 'file',
    getFile: () => file.getFile(),
    createWritable: async () => {
      // The backup's own files are let through: this fault is about the changes to the card.
      if (fault.way === 'stopsPartWay' && !path.startsWith(`${BACKUPS_FOLDER}/`) && ++fault.writes === fault.failWrite) {
        throw madeToFail('A write')
      }
      return file.createWritable()
    },
  })

  return {
    kind: 'directory',
    async *entries() {
      for await (const [name, entry] of folder.entries()) {
        yield [name, entry.kind === 'directory' ? misbehaving(entry, fault, `${path}${name}/`) : fileFor(entry)]
      }
    },
    requestPermission: async (descriptor) => (fault.way === 'notAllowed' ? 'denied' : folder.requestPermission(descriptor)),
    getDirectoryHandle: async (name, options) => {
      if (fault.way === 'backupFailed' && path === '' && name === BACKUPS_FOLDER) throw madeToFail('The backup')
      return misbehaving(await folder.getDirectoryHandle(name, options), fault, `${path}${name}/`)
    },
    getFileHandle: async (name, options) => fileFor(await folder.getFileHandle(name, options)),
    removeEntry: (name, options) => folder.removeEntry(name, options),
  }
}

/** Changes the card the way another program would: sets the radio to a different model. */
async function changeFromOutside(folder: FileSystemDirectoryHandle): Promise<void> {
  const read = await readRadioFolder(folder)
  if (!read.ok) return
  const other = read.reading.models.find((model) => model.position !== read.reading.currentPosition)
  const settings = other && withCurrentModelNumber(read.card.get(RADIO_SETTINGS_PATH)!, other.position - 1)
  if (!settings?.ok) return
  const file = await (await folder.getDirectoryHandle('RADIO')).getFileHandle('radio.yml')
  const writing = await file.createWritable()
  await writing.write(new Uint8Array(settings.bytes))
  await writing.close()
}

/**
 * One of the made-up cards, in private storage, as a card the app can read and save to. The app
 * is handed this in place of a folder a person picked, and does not know the difference.
 * `firstSave` sets the reviewer's switch, for a state that is about a save going wrong.
 */
export async function privateConnectionWith(card: ReviewCard, firstSave: NextSave | null = null): Promise<CardConnection> {
  const folder = await privateFolderWith(card)
  nextSave.set(firstSave)

  const fault: Fault = { way: null, failWrite: 0, writes: 0 }
  const faulty = misbehaving(folder, fault)
  let link = connectTo(faulty)

  return {
    read: () => link.read(),
    async save(held, changes) {
      const way = nextSave.take()
      if (way === 'neverEnds') return new Promise<SaveResult>(() => undefined)
      if (way === 'cardChanged') await changeFromOutside(folder)
      // A backup is only made on the first save after a Connect, so this one is made to be that.
      if (way === 'backupFailed') link = connectTo(faulty)

      fault.way = way
      fault.writes = 0
      // The second write, so that one change has already been made. A lone write has to be the one.
      fault.failWrite = changes.filter((change) => change.kind === 'write').length > 1 ? 2 : 1
      try {
        return await link.save(held, changes)
      } finally {
        fault.way = null
      }
    },
  }
}
