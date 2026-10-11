// Reading the radio's card out of a folder.
//
// This is the one place the app touches a folder. It takes a folder's handle, the kind the
// browser's folder picker gives, and does two things with it: lists what is in a folder, and reads
// a file's bytes. The two types below are the read side of a handle and nothing more. They have
// nothing that writes, removes or asks for more permission, so nothing in here can.
//
// The names are matched exactly as the radio writes them: MODELS, RADIO, DELETED, radio.yml.

import {
  DELETED_FOLDER,
  MODELS_FOLDER,
  RADIO_FOLDER,
  RADIO_SETTINGS_PATH,
  readCard,
  type Card,
  type CardReading,
} from '../files/card.ts'

/** The read side of a file's handle: its bytes. */
export interface FileToRead {
  readonly kind: 'file'
  getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>
}

/** The read side of a folder's handle: each name in it, with that entry's own handle. */
export interface FolderToRead {
  readonly kind: 'directory'
  entries(): AsyncIterable<[string, FolderToRead | FileToRead]>
}

export type FolderProblem =
  /** There is no MODELS folder in it, or no RADIO/radio.yml. It is not the top folder of a radio's drive. */
  | 'wrongFolder'
  /** It looked like a radio's drive, but reading it failed part way. */
  | 'couldNotRead'

export type FolderReading = { ok: true; card: Card; reading: CardReading } | { ok: false; problem: FolderProblem }

type Entries = ReadonlyMap<string, FolderToRead | FileToRead>

async function entriesOf(folder: FolderToRead): Promise<Entries> {
  const entries = new Map<string, FolderToRead | FileToRead>()
  for await (const [name, handle] of folder.entries()) entries.set(name, handle)
  return entries
}

function folderNamed(entries: Entries, name: string): FolderToRead | null {
  const entry = entries.get(name)
  return entry?.kind === 'directory' ? entry : null
}

/** Reads every file that is directly in a folder into the card. Folders inside it are not followed. */
async function readFiles(card: Map<string, Uint8Array>, entries: Entries, folderPath: string): Promise<void> {
  for (const [name, entry] of entries) {
    if (entry.kind !== 'file') continue
    const file = await entry.getFile()
    card.set(`${folderPath}/${name}`, new Uint8Array(await file.arrayBuffer()))
  }
}

/**
 * Reads a radio's card from the top folder of its drive: every file in MODELS, in MODELS/DELETED
 * and in RADIO. Nothing else in the folder is opened, and nothing is written.
 */
export async function readRadioFolder(folder: FolderToRead): Promise<FolderReading> {
  try {
    const top = await entriesOf(folder)
    const models = folderNamed(top, MODELS_FOLDER)
    const radio = folderNamed(top, RADIO_FOLDER)
    if (!models || !radio) return { ok: false, problem: 'wrongFolder' }

    const inModels = await entriesOf(models)
    const inRadio = await entriesOf(radio)
    const card = new Map<string, Uint8Array>()
    await readFiles(card, inRadio, RADIO_FOLDER)
    if (!card.has(RADIO_SETTINGS_PATH)) return { ok: false, problem: 'wrongFolder' }

    await readFiles(card, inModels, MODELS_FOLDER)
    const deleted = folderNamed(inModels, DELETED_FOLDER)
    if (deleted) await readFiles(card, await entriesOf(deleted), `${MODELS_FOLDER}/${DELETED_FOLDER}`)
    return { ok: true, card, reading: readCard(card) }
  } catch {
    return { ok: false, problem: 'couldNotRead' }
  }
}
