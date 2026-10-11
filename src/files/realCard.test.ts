/// <reference types="node" />
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { cardFromFolder } from '../test/cardFromFolder.ts'
import { readCard, type Card } from './card.ts'
import { deleteFromCard, moveOnCard, restoreOnCard, type CardResult } from './cardActions.ts'
import { applyChanges, sameBytes } from './changes.ts'

// A copy of a real radio's card, when this computer has one. It is never part of the repo, and
// nothing from inside it is written here. It is only ever read: every change below is made to a
// card held in memory. On a computer without the folder this test is skipped.
const folder = path.join(os.homedir(), 'Desktop', 'mt12-card')

const sameCard = (first: Card, second: Card): boolean =>
  first.size === second.size && [...first].every(([at, bytes]) => second.has(at) && sameBytes(second.get(at)!, bytes))

/** The new card, once the list of changes has been shown to give it from the old one. */
function done<Also>(before: Card, result: CardResult<Also>, what: string): Extract<CardResult<Also>, { ok: true }> {
  if (!result.ok) throw new Error(`${what} was refused: ${result.problem}`)
  expect(sameCard(applyChanges(before, result.changes), result.card), what).toBe(true)
  return result
}

test.skipIf(!existsSync(folder))('the real card reads cleanly, and every model survives a move and a delete, byte for byte', () => {
  const card = cardFromFolder(folder, ['MODELS', 'RADIO'])
  const reading = readCard(card)

  expect(reading.refused).toEqual([])
  expect(reading.checksum?.right).toBe(true)
  expect(reading.models.length).toBeGreaterThan(0)
  expect(reading.currentPosition).not.toBeNull()

  for (const { position } of reading.models) {
    const where = `position ${position}`

    // To the last place and back.
    const away = done(card, moveOnCard(card, position, 60), `moving ${where}`)
    expect(sameCard(away.card, card) === (position === 60), where).toBe(true)
    const home = done(away.card, moveOnCard(away.card, 60, position), `moving ${where} back`)
    expect(sameCard(home.card, card), `${where}, moved and moved back`).toBe(true)

    // Deleted and restored, both ways of deleting. The radio cannot stay set to a model that is
    // gone, so deleting that one names another to switch to, and restoring it sets the radio back.
    const isCurrent = position === reading.currentPosition
    const switchTo = isCurrent ? reading.models.find((other) => other.position !== position)?.position : undefined
    for (const closeUp of [false, true]) {
      const how = `${where}, ${closeUp ? 'closing up' : 'leaving its place empty'}`
      const gone = done(card, deleteFromCard(card, position, { closeUp, switchTo }), `deleting ${how}`)
      expect(readCard(gone.card).models).toHaveLength(reading.models.length - 1)
      expect(sameBytes(gone.card.get(gone.deletedPath)!, card.get(reading.models.find((model) => model.position === position)!.path)!), how).toBe(true)
      const back = done(gone.card, restoreOnCard(gone.card, gone.deletedPath, { setRadioToIt: isCurrent }), `restoring ${how}`)
      expect(sameCard(back.card, card), `${how}, deleted and restored`).toBe(true)
    }
  }
})
