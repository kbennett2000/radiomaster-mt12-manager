/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Card } from '../files/card.ts'

/**
 * For tests: reads folders from disk into a card. Each of `folders` is read with everything under
 * it, and each file's path on the card starts with that folder's name. It only ever reads.
 */
export function cardFromFolder(root: string, folders: readonly string[]): Card {
  const card = new Map<string, Uint8Array>()
  for (const folder of folders) {
    for (const entry of readdirSync(path.join(root, folder), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const full = path.join(entry.parentPath, entry.name)
      card.set(path.relative(root, full).split(path.sep).join('/'), new Uint8Array(readFileSync(full)))
    }
  }
  return card
}
