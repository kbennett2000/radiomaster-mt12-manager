// For reviewers only, and not part of the product: a made-up card, put where the browser can hand
// the app a folder without the folder picker.
//
// The browser keeps a private storage for each site, which no other site and no other program can
// see. A reviewer's link writes one of the made-up cards there and gives back that folder's handle.
// The app then reads it with the same code that reads a folder a person picked. This file writes
// the made-up card there, and it can only write into that private storage. A folder a person
// picked is written by src/platform/saveToFolder.ts and by nothing else.

import type { ReviewCard } from '../state/scenarios.ts'
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
