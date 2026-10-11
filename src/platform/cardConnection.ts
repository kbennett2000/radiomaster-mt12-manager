// A connected card: one folder, as a thing the app can read and can save to.
//
// The screens deal with a card through this and nothing else. Reading is src/platform/radioFolder.ts
// and saving is src/platform/saveToFolder.ts. This only keeps the two together for one Connect.

import type { Card } from '../files/card.ts'
import type { Change } from '../files/changes.ts'
import { readRadioFolder, type FolderReading } from './radioFolder.ts'
import { cardSaver, type FolderToChange, type SaveResult } from './saveToFolder.ts'

export interface CardConnection {
  /**
   * Reads the card from the folder. Reading it is a new start: whatever the app held before is
   * dropped, so the next change is backed up first, as the first change after a Connect is.
   */
  read(): Promise<FolderReading>
  /**
   * Carries out a list of changes on the folder. `card` is the card the app holds, which the
   * changes were worked out from. Call it straight from the person's click.
   */
  save(card: Card, changes: readonly Change[]): Promise<SaveResult>
}

/** Connects to a folder the person picked. The browser has only been asked to let the app read it. */
export function connectTo(folder: FolderToChange): CardConnection {
  const saver = cardSaver(folder)
  return {
    read: () => {
      saver.startAfresh()
      return readRadioFolder(folder)
    },
    save: (card, changes) => saver.save(card, changes),
  }
}
