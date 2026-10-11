/// <reference types="node" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { cardFromFolder } from '../test/cardFromFolder.ts'
import { deletedFrom, modelPath, positionOfModelPath, RADIO_SETTINGS_PATH, readCard, type Card } from './card.ts'
import {
  closeUpOnCard,
  copyOnCard,
  deleteFromCard,
  moveOnCard,
  renameOnCard,
  restoreOnCard,
  type CardResult,
} from './cardActions.ts'
import { applyChanges, changesBetween, sameBytes, type Change } from './changes.ts'
import { bytesFromText, documentFromBytes, valueAt } from './document.ts'
import { crc16, withCurrentModelNumber } from './radioSettings.ts'

// A made-up card: five invented models in positions 1, 2, 3, 5 and 6, with position 4 empty.
// The radio is set to the model in position 5. Each folder also has a file the app leaves alone.
const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'testdata', 'card')
const madeUp = (): Card => cardFromFolder(folder, ['MODELS', 'RADIO'])
const START = ['1 Pebble', '2 Gravel Cat', '3 Mudskipper', '5 Tin Snail', '6 Bog Hopper']

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)
const lines = (bytes: Uint8Array): string[] => text(bytes).split('\r\n')
/** The models on a card, as "position name". */
const models = (card: Card): string[] => readCard(card).models.map((model) => `${model.position} ${model.name}`)
/** The name of the model the radio is set to. */
function current(card: Card): string | null {
  const reading = readCard(card)
  return reading.models.find((model) => model.position === reading.currentPosition)?.name ?? null
}
const settings = (card: Card): Uint8Array => card.get(RADIO_SETTINGS_PATH)!
const currModel = (card: Card): string | null => {
  const read = documentFromBytes(settings(card))
  return read.ok ? valueAt(read.document, 'currModel') : null
}
/** The bytes of the file the settings name, or nothing when they name a file that is not there. */
const namedBySettings = (card: Card): Uint8Array | undefined => card.get(modelPath(Number(currModel(card)) + 1))
const sameCard = (first: Card, second: Card): boolean =>
  first.size === second.size && [...first].every(([at, bytes]) => second.has(at) && sameBytes(second.get(at)!, bytes))
/** A card with something else at a path. */
const withFile = (card: Card, at: string, content: string | Uint8Array): Card =>
  new Map(card).set(at, typeof content === 'string' ? bytesFromText(content) : content)
const withoutFile = (card: Card, at: string): Card => new Map([...card].filter(([other]) => other !== at))
/** A card with every one of the 60 places taken, by copies of the first model under other names. */
function fullCard(): Card {
  const card = new Map(madeUp())
  const first = text(card.get(modelPath(1))!)
  for (let position = 1; position <= 60; position += 1) {
    if (!card.has(modelPath(position))) card.set(modelPath(position), bytesFromText(first.replace('"Pebble"', `"Spare ${position}"`)))
  }
  return card
}

/** True for a file that holds a model, whether it is in a place or among the deleted. */
const holdsAModel = (at: string): boolean => positionOfModelPath(at) !== null || deletedFrom(at) !== null
const contents = (card: Card): string[] => [...card].filter(([at]) => holdsAModel(at)).map(([, bytes]) => text(bytes))

/**
 * What must be true of every result: the list of changes turns the old card into the new one,
 * its writes all come before its removes, no model is without a copy at any point part way
 * through, the radio is never left set to the wrong model part way through, the files the app
 * leaves alone are untouched, and the settings' checksum is right.
 */
function done<Also>(before: Card, result: CardResult<Also>): Extract<CardResult<Also>, { ok: true }> {
  if (!result.ok) throw new Error(`refused: ${result.problem}`)
  const { card: after, changes } = result
  expect(sameCard(applyChanges(before, changes), after), 'the changes give the new card').toBe(true)

  const kinds = changes.map((change) => change.kind)
  expect(kinds.lastIndexOf('write') < (kinds.includes('remove') ? kinds.indexOf('remove') : kinds.length), 'writes come first').toBe(true)

  // Every model that is on both cards is in some file after each change, however far the list has got.
  const kept = contents(before).filter((model) => contents(after).includes(model))
  for (let count = 0; count <= changes.length; count += 1) {
    const partWay = contents(applyChanges(before, changes.slice(0, count)))
    for (const model of kept) expect(partWay.includes(model), `a model is lost after ${count} changes`).toBe(true)
  }

  // After each change, however far the list has got, the file the settings name holds the model
  // the radio is meant to be set to: the one before the action, or the one after it.
  const [was, willBe] = [namedBySettings(before), namedBySettings(after)]
  if (was && willBe) {
    for (let count = 0; count <= changes.length; count += 1) {
      const named = namedBySettings(applyChanges(before, changes.slice(0, count)))
      const right = named !== undefined && (sameBytes(named, was) || sameBytes(named, willBe))
      expect(right, `the radio is set to the wrong model after ${count} changes`).toBe(true)
    }
  }

  for (const at of readCard(before).others) {
    expect(sameBytes(after.get(at)!, before.get(at)!), `${at} is left alone`).toBe(true)
    expect(changes.some((change) => change.path === at), `${at} is not in the changes`).toBe(false)
  }
  if (readCard(before).checksum?.right) expect(readCard(after).checksum?.right, 'the checksum is right').toBe(true)
  return result
}
const writes = (changes: readonly Change[]): string[] => changes.flatMap((change) => (change.kind === 'write' ? [change.path] : []))
const removes = (changes: readonly Change[]): string[] => changes.flatMap((change) => (change.kind === 'remove' ? [change.path] : []))

// The checksum

test('the checksum is the radio\'s 16-bit check, and the made-up settings carry the right one', () => {
  expect(crc16(bytesFromText('123456789'))).toBe(10673)
  // The number in the made-up file was worked out by other code than the app's.
  expect(readCard(madeUp()).checksum).toEqual({ written: 53631, expected: 53631, right: true })
  // One changed byte anywhere after the first line makes it wrong.
  const edited = withFile(madeUp(), RADIO_SETTINGS_PATH, text(settings(madeUp())).replace('contrast: 22', 'contrast: 23'))
  expect(readCard(edited).checksum?.right).toBe(false)
})

// Reading a card

test('a card gives its models by position, the one the radio is set to, and what could not be read', () => {
  const reading = readCard(madeUp())

  expect(models(madeUp())).toEqual(START)
  expect(reading.models.map((model) => model.path)).toEqual([1, 2, 3, 5, 6].map(modelPath))
  expect(modelPath(1)).toBe('MODELS/model00.yml')
  expect(modelPath(60)).toBe('MODELS/model59.yml')
  expect(reading.models.map((model) => model.receiverTypeId)).toEqual(['dumborc-x', 'spektrum-dsmr', 'spektrum-slt', null, 'traxxas-tq'])
  // A receiver the app's list does not have still gives its two numbers.
  expect(reading.models[3].receiverNumbers).toEqual([99, 1])
  expect(reading.currentPosition).toBe(5)
  expect(current(madeUp())).toBe('Tin Snail')
  expect(reading.refused).toEqual([])
  expect(reading.deleted).toEqual([])
  expect(reading.others).toEqual(['MODELS/README.txt', 'RADIO/README.txt'])

  // A model file that cannot be read still holds its position, and is listed with the reason and line.
  const broken = readCard(withFile(madeUp(), modelPath(4), 'semver: 2.10.0\r\nthis is not a line\r\n'))
  expect(broken.models.map((model) => `${model.position} ${model.name}`)).toEqual([...START.slice(0, 3), '4 null', ...START.slice(3)])
  expect(broken.refused).toEqual([{ path: 'MODELS/model03.yml', line: 2, reason: 'notALine' }])

  // Only modelNN.yml from 00 to 59 is a model. Anything else in the two folders is left alone.
  const odd = withFile(withFile(withFile(madeUp(), 'MODELS/model60.yml', 'x'), 'MODELS/model7.yml', 'x'), 'MODELS/notes/plan.txt', 'x')
  expect(models(odd)).toEqual(START)
  expect(readCard(odd).others).toEqual(['MODELS/README.txt', 'MODELS/model60.yml', 'MODELS/model7.yml', 'MODELS/notes/plan.txt', 'RADIO/README.txt'])
  // And anything outside them is not the app's business at all.
  expect(readCard(withFile(madeUp(), 'SOUNDS/en/hello.wav', 'x')).others).toEqual(['MODELS/README.txt', 'RADIO/README.txt'])

  // Without settings the app cannot say which model the radio is set to.
  const without = readCard(withoutFile(madeUp(), RADIO_SETTINGS_PATH))
  expect([without.currentPosition, without.checksum]).toEqual([null, null])
  const unreadable = readCard(withFile(madeUp(), RADIO_SETTINGS_PATH, 'checksum: 1\n'))
  expect(unreadable.currentPosition).toBeNull()
  expect(unreadable.refused).toEqual([{ path: RADIO_SETTINGS_PATH, line: 1, reason: 'lineEnding' }])
})

// Rename

test('renaming a model changes only the name line of its file', () => {
  const card = madeUp()
  const { card: after, changes } = done(card, renameOnCard(card, 3, ' Mud Shark '))

  expect(changes.map((change) => `${change.kind} ${change.path}`)).toEqual(['write MODELS/model02.yml'])
  expect(models(after)).toEqual(['1 Pebble', '2 Gravel Cat', '3 Mud Shark', '5 Tin Snail', '6 Bog Hopper'])
  const [was, now] = [lines(card.get(modelPath(3))!), lines(after.get(modelPath(3))!)]
  expect(now.flatMap((line, index) => (line === was[index] ? [] : [`${index + 1}: ${line}`]))).toEqual(['3:    name: "Mud Shark"'])
  expect(now).toHaveLength(was.length)

  // The other models on the card are the names already taken. Its own name is not in the way.
  expect(renameOnCard(card, 3, 'tin snail')).toEqual({ ok: false, problem: 'alreadyUsed' })
  expect(done(card, renameOnCard(card, 3, 'Mudskipper')).changes).toEqual([])
  expect(renameOnCard(card, 3, 'Mudskipper 2')).toEqual({ ok: false, problem: 'tooLong' })
  expect(renameOnCard(card, 3, '')).toEqual({ ok: false, problem: 'empty' })
  expect(renameOnCard(card, 3, 'Mud "S"')).toEqual({ ok: false, problem: 'cannotBeWritten' })
  expect(renameOnCard(card, 4, 'Newt')).toEqual({ ok: false, problem: 'noModelThere' })
  expect(renameOnCard(card, 61, 'Newt')).toEqual({ ok: false, problem: 'noSuchPlace' })
})

// Copy

test('a copy goes in the first empty place after the original, and differs only in its name line', () => {
  const card = madeUp()
  const copied = done(card, copyOnCard(card, 2, 'Gravel Dog'))

  expect(copied.position).toBe(4)
  expect(copied.changes.map((change) => `${change.kind} ${change.path}`)).toEqual(['write MODELS/model03.yml'])
  expect(models(copied.card)).toEqual(['1 Pebble', '2 Gravel Cat', '3 Mudskipper', '4 Gravel Dog', '5 Tin Snail', '6 Bog Hopper'])
  const [original, copy] = [lines(card.get(modelPath(2))!), lines(copied.card.get(modelPath(4))!)]
  expect(copy.flatMap((line, index) => (line === original[index] ? [] : [`${index + 1}: ${line}`]))).toEqual(['3:    name: "Gravel Dog"'])
  expect(current(copied.card)).toBe('Tin Snail')

  // After the last model the next place is free. With nothing free after, the first one before.
  expect(done(card, copyOnCard(card, 6, 'Bog Jumper')).position).toBe(7)
  const onlyFourFree = withoutFile(fullCard(), modelPath(4))
  expect(done(onlyFourFree, copyOnCard(onlyFourFree, 60, 'Newt')).position).toBe(4)

  // The copy needs a name of its own, by the same rules as any model.
  expect(copyOnCard(card, 2, 'Gravel Cat')).toEqual({ ok: false, problem: 'alreadyUsed' })
  expect(copyOnCard(card, 2, 'Gravel Cat 2')).toEqual({ ok: false, problem: 'tooLong' })
  expect(copyOnCard(card, 4, 'Newt')).toEqual({ ok: false, problem: 'noModelThere' })
})

// Delete and restore

test('deleting a model keeps its bytes among the deleted, and restoring it gives the original card', () => {
  const card = madeUp()
  const gone = done(card, deleteFromCard(card, 2, { closeUp: false }))

  expect(models(gone.card)).toEqual(['1 Pebble', '3 Mudskipper', '5 Tin Snail', '6 Bog Hopper'])
  expect(gone.deletedPath).toBe('MODELS/DELETED/0001-model01.yml')
  expect(sameBytes(gone.card.get(gone.deletedPath)!, card.get(modelPath(2))!)).toBe(true)
  expect(gone.changes.map((change) => `${change.kind} ${change.path}`)).toEqual([
    'write MODELS/DELETED/0001-model01.yml',
    'remove MODELS/model01.yml',
  ])
  // The radio's model did not move, so the settings are byte for byte the same and are not written.
  expect(sameBytes(settings(gone.card), settings(card))).toBe(true)
  expect(readCard(gone.card).deleted.map((model) => `${model.name}, from ${model.cameFrom}`)).toEqual(['Gravel Cat, from 2'])

  const back = done(gone.card, restoreOnCard(gone.card, gone.deletedPath))
  expect(back.position).toBe(2)
  expect(sameCard(back.card, card)).toBe(true)
  expect(restoreOnCard(card, gone.deletedPath)).toEqual({ ok: false, problem: 'noSuchDeletedModel' })
  expect(restoreOnCard(card, modelPath(1))).toEqual({ ok: false, problem: 'noSuchDeletedModel' })
  expect(deleteFromCard(card, 4, { closeUp: false })).toEqual({ ok: false, problem: 'noModelThere' })
})

test('deleting and closing up moves the later models up, and the radio\'s model is followed', () => {
  const card = madeUp()
  const gone = done(card, deleteFromCard(card, 2, { closeUp: true }))

  // Every place after it moves up one, the empty place too.
  expect(models(gone.card)).toEqual(['1 Pebble', '2 Mudskipper', '4 Tin Snail', '5 Bog Hopper'])
  expect(current(gone.card)).toBe('Tin Snail')
  expect(currModel(gone.card)).toBe('3')
  // Two lines of the settings change: the model's number, and the checksum on the first line.
  const [was, now] = [lines(settings(card)), lines(settings(gone.card))]
  expect(now.flatMap((line, index) => (line === was[index] ? [] : [index + 1]))).toEqual([1, 11])
  expect(now[0]).toMatch(/^checksum: \d+$/)
  // The settings are written straight after the file they name, before that model's old file is
  // written over. The old files go after every write.
  const order = writes(gone.changes)
  expect(order[order.indexOf(RADIO_SETTINGS_PATH) - 1]).toBe('MODELS/model03.yml')
  expect(order.indexOf('MODELS/model04.yml')).toBeGreaterThan(order.indexOf(RADIO_SETTINGS_PATH))
  expect(removes(gone.changes)).toEqual(['MODELS/model02.yml', 'MODELS/model05.yml'])

  // Its place has been taken since, so the models from there to the next empty place make room.
  const back = done(gone.card, restoreOnCard(gone.card, gone.deletedPath))
  expect(models(back.card)).toEqual(['1 Pebble', '2 Gravel Cat', '3 Mudskipper', '4 Tin Snail', '5 Bog Hopper'])
  expect(current(back.card)).toBe('Tin Snail')
})

test('a delete and its restore give the original card, both ways of deleting, for every model', () => {
  // Closing up and restoring only gives the same card back when no empty place sat after the
  // model, so this starts from the made-up card with its empty place closed up.
  const start = madeUp()
  const card = done(start, closeUpOnCard(start)).card
  expect(models(card)).toEqual(['1 Pebble', '2 Gravel Cat', '3 Mudskipper', '4 Tin Snail', '5 Bog Hopper'])

  for (const closeUp of [false, true]) {
    for (let position = 1; position <= 5; position += 1) {
      // The radio is set to the model in position 4, so deleting that one needs another to switch to.
      const isCurrent = position === 4
      const gone = done(card, deleteFromCard(card, position, { closeUp, switchTo: isCurrent ? 1 : undefined }))
      expect(readCard(gone.card).models).toHaveLength(4)
      const back = done(gone.card, restoreOnCard(gone.card, gone.deletedPath, { setRadioToIt: isCurrent }))
      expect(sameCard(back.card, card), `position ${position}, closing up: ${closeUp}`).toBe(true)
    }
  }
})

test('deleting the model the radio is set to needs another model to switch to', () => {
  const card = madeUp()
  expect(deleteFromCard(card, 5, { closeUp: false })).toEqual({ ok: false, problem: 'switchToNeeded' })
  expect(deleteFromCard(card, 5, { closeUp: false, switchTo: 5 })).toEqual({ ok: false, problem: 'switchToNeeded' })
  expect(deleteFromCard(card, 5, { closeUp: false, switchTo: 4 })).toEqual({ ok: false, problem: 'switchToNeeded' })

  const gone = done(card, deleteFromCard(card, 5, { closeUp: true, switchTo: 6 }))
  expect(models(gone.card)).toEqual(['1 Pebble', '2 Gravel Cat', '3 Mudskipper', '5 Bog Hopper'])
  expect(current(gone.card)).toBe('Bog Hopper')
  expect(currModel(gone.card)).toBe('4')

  // Restoring it does not change what the radio is set to, unless the caller asks.
  const back = done(gone.card, restoreOnCard(gone.card, gone.deletedPath))
  expect(models(back.card)).toEqual(START)
  expect(current(back.card)).toBe('Bog Hopper')
  const asItWas = done(gone.card, restoreOnCard(gone.card, gone.deletedPath, { setRadioToIt: true }))
  expect(sameCard(asItWas.card, card)).toBe(true)

  // With the radio set to an empty place, no model is current and nothing needs switching.
  const setToEmpty = done(card, moveOnCard(card, 5, 4)).card
  const emptied = done(setToEmpty, deleteFromCard(setToEmpty, 4, { closeUp: false, switchTo: 1 })).card
  expect(current(emptied)).toBe('Pebble')
})

test('a deleted model\'s file name can never clash with another, and the last one deleted comes first', () => {
  let card = madeUp()
  const first = done(card, deleteFromCard(card, 2, { closeUp: false }))
  card = done(first.card, renameOnCard(first.card, 3, 'Newt')).card
  card = done(card, moveOnCard(card, 3, 2)).card
  // Another model deleted from the same position gets the next number.
  const second = done(card, deleteFromCard(card, 2, { closeUp: false }))
  expect([first.deletedPath, second.deletedPath]).toEqual(['MODELS/DELETED/0001-model01.yml', 'MODELS/DELETED/0002-model01.yml'])
  expect(readCard(second.card).deleted.map((model) => model.name)).toEqual(['Newt', 'Gravel Cat'])

  // Bringing the older one back leaves the number of the newer one in use, so the next is higher still.
  card = done(second.card, restoreOnCard(second.card, first.deletedPath)).card
  expect(done(card, deleteFromCard(card, 1, { closeUp: false })).deletedPath).toBe('MODELS/DELETED/0003-model00.yml')
})

// Move and close up

test('a move and the move back give the original card, for a model and for an empty place', () => {
  const card = madeUp()

  // Three models swap round in a full circle. No place among them is empty, so one is copied to a
  // spare file before anything is written over, and the spare is removed at the end.
  const moved = done(card, moveOnCard(card, 1, 3))
  expect(models(moved.card)).toEqual(['1 Gravel Cat', '2 Mudskipper', '3 Pebble', '5 Tin Snail', '6 Bog Hopper'])
  expect(writes(moved.changes)[0]).toBe('MODELS/DELETED/0001-model00.yml')
  expect(removes(moved.changes)).toEqual(['MODELS/DELETED/0001-model00.yml'])
  expect(sameBytes(settings(moved.card), settings(card))).toBe(true)
  expect(sameCard(done(moved.card, moveOnCard(moved.card, 3, 1)).card, card)).toBe(true)

  // The radio's model is moved, and the settings follow it there and back.
  const current5to2 = done(card, moveOnCard(card, 5, 2))
  expect(models(current5to2.card)).toEqual(['1 Pebble', '2 Tin Snail', '3 Gravel Cat', '4 Mudskipper', '6 Bog Hopper'])
  expect([current(current5to2.card), currModel(current5to2.card)]).toEqual(['Tin Snail', '1'])
  expect(sameCard(done(current5to2.card, moveOnCard(current5to2.card, 2, 5)).card, card)).toBe(true)

  // An empty place moves the same way, and the place it lands in is empty.
  const emptyMoved = done(card, moveOnCard(card, 4, 1))
  expect(models(emptyMoved.card)).toEqual(['2 Pebble', '3 Gravel Cat', '4 Mudskipper', '5 Tin Snail', '6 Bog Hopper'])
  expect(sameCard(done(emptyMoved.card, moveOnCard(emptyMoved.card, 1, 4)).card, card)).toBe(true)

  // Every model, to the last place and back.
  for (const position of [1, 2, 3, 5, 6]) {
    const away = done(card, moveOnCard(card, position, 60))
    expect(readCard(away.card).models.at(-1)?.position).toBe(60)
    expect(current(away.card)).toBe('Tin Snail')
    expect(sameCard(done(away.card, moveOnCard(away.card, 60, position)).card, card), `position ${position}`).toBe(true)
  }

  expect(done(card, moveOnCard(card, 3, 3)).changes).toEqual([])
  expect(moveOnCard(card, 3, 61)).toEqual({ ok: false, problem: 'noSuchPlace' })
  expect(moveOnCard(card, 0, 3)).toEqual({ ok: false, problem: 'noSuchPlace' })
})

test('closing up removes every empty place with a model after it, and the radio\'s model is followed', () => {
  const card = madeUp()
  const closed = done(card, closeUpOnCard(card))

  expect(models(closed.card)).toEqual(['1 Pebble', '2 Gravel Cat', '3 Mudskipper', '4 Tin Snail', '5 Bog Hopper'])
  expect([current(closed.card), currModel(closed.card)]).toEqual(['Tin Snail', '3'])
  expect(closed.changes.map((change) => `${change.kind} ${change.path}`)).toEqual([
    'write MODELS/model03.yml',
    'write RADIO/radio.yml',
    'write MODELS/model04.yml',
    'remove MODELS/model05.yml',
  ])
  expect(done(closed.card, closeUpOnCard(closed.card)).changes).toEqual([])
})

// A file that cannot be read, a full card, and settings that cannot be trusted

test('a model that cannot be read can be moved and deleted, but not renamed or copied', () => {
  const card = withFile(madeUp(), modelPath(4), 'this is not a model\r\n')
  const unread = card.get(modelPath(4))!

  expect(renameOnCard(card, 4, 'Newt')).toEqual({ ok: false, problem: 'modelNotRead' })
  expect(copyOnCard(card, 4, 'Newt')).toEqual({ ok: false, problem: 'modelNotRead' })

  const moved = done(card, moveOnCard(card, 4, 1))
  expect(sameBytes(moved.card.get(modelPath(1))!, unread)).toBe(true)
  const gone = done(card, deleteFromCard(card, 4, { closeUp: true }))
  expect(sameBytes(gone.card.get(gone.deletedPath)!, unread)).toBe(true)
  expect(sameCard(done(gone.card, restoreOnCard(gone.card, gone.deletedPath)).card, card)).toBe(true)
})

test('a full card has no room for a copy or for a deleted model to come back', () => {
  const full = fullCard()
  expect(readCard(full).models).toHaveLength(60)
  expect(copyOnCard(full, 2, 'Newt')).toEqual({ ok: false, problem: 'cardFull' })

  // Delete one, fill its place again, and the deleted one has nowhere to go.
  const gone = done(full, deleteFromCard(full, 2, { closeUp: false }))
  const refilled = done(gone.card, copyOnCard(gone.card, 1, 'Newt'))
  expect(refilled.position).toBe(2)
  expect(restoreOnCard(refilled.card, gone.deletedPath)).toEqual({ ok: false, problem: 'cardFull' })
  // Moving still works on a full card: 60 models swap round with one spare file.
  expect(models(done(full, moveOnCard(full, 60, 1)).card).slice(0, 2)).toEqual(['1 Spare 60', '2 Pebble'])
})

test('settings that cannot be read, or whose checksum is wrong, are never written over', () => {
  for (const card of [withoutFile(madeUp(), RADIO_SETTINGS_PATH), withFile(madeUp(), RADIO_SETTINGS_PATH, 'not settings\r\n')]) {
    // The app cannot tell which model the radio is set to, so it moves nothing.
    expect(moveOnCard(card, 1, 3)).toEqual({ ok: false, problem: 'radioSettingsNotRead' })
    expect(closeUpOnCard(card)).toEqual({ ok: false, problem: 'radioSettingsNotRead' })
    expect(deleteFromCard(card, 1, { closeUp: false })).toEqual({ ok: false, problem: 'radioSettingsNotRead' })
    // A rename and a copy move nothing, so they still work.
    expect(models(done(card, renameOnCard(card, 1, 'Newt')).card)[0]).toBe('1 Newt')
    expect(done(card, copyOnCard(card, 1, 'Newt')).position).toBe(4)
  }

  const wrong = withFile(madeUp(), RADIO_SETTINGS_PATH, text(settings(madeUp())).replace('contrast: 22', 'contrast: 23'))
  expect(readCard(wrong).checksum?.right).toBe(false)
  // The radio's model would move, so the settings would have to be written: refused.
  expect(moveOnCard(wrong, 5, 2)).toEqual({ ok: false, problem: 'checksumWrong' })
  expect(closeUpOnCard(wrong)).toEqual({ ok: false, problem: 'checksumWrong' })
  // It would not move, so the settings stay as they are, wrong checksum and all.
  const moved = done(wrong, moveOnCard(wrong, 1, 3))
  expect(sameBytes(settings(moved.card), settings(wrong))).toBe(true)
})

// The list of changes

test('changes are listed with every write before any remove, in an order that is safe to stop in', () => {
  const card = madeUp()
  // A chain with an empty place to start from needs no spare: each file is written before the
  // one it came from is written over.
  const chain = done(card, moveOnCard(card, 3, 5))
  expect(models(chain.card)).toEqual(['1 Pebble', '2 Gravel Cat', '4 Tin Snail', '5 Mudskipper', '6 Bog Hopper'])
  expect(chain.changes.map((change) => `${change.kind} ${change.path}`)).toEqual([
    'write MODELS/model03.yml',
    'write RADIO/radio.yml',
    'write MODELS/model04.yml',
    'remove MODELS/model02.yml',
  ])

  // Between any two cards the list gives the second from the first, and nothing for no difference.
  expect(changesBetween(card, card)).toEqual([])
  const other = done(chain.card, deleteFromCard(chain.card, 1, { closeUp: true })).card
  expect(sameCard(applyChanges(card, changesBetween(card, other)), other)).toBe(true)
  expect(sameCard(applyChanges(other, changesBetween(other, card)), card)).toBe(true)
})

// The radio is never left set to the wrong model

/** The made-up kind of card with the radio set to the model in another position. */
function setTo(card: Card, position: number): Card {
  const set = withCurrentModelNumber(settings(card), position - 1)
  if (!set.ok) throw new Error('the settings could not be changed')
  return withFile(card, RADIO_SETTINGS_PATH, set.bytes)
}
const listed = (changes: readonly Change[]): string[] => changes.map((change) => `${change.kind} ${change.path}`)

test('the settings follow the radio\'s model before its old file is written over', () => {
  // The radio is set to Tin Snail in position 5. Moving position 3 to 5 moves Tin Snail up into
  // position 4, and puts Mudskipper in the file Tin Snail was in.
  const card = madeUp()
  const moved = done(card, moveOnCard(card, 3, 5))
  expect(listed(moved.changes)).toEqual([
    'write MODELS/model03.yml',
    'write RADIO/radio.yml',
    'write MODELS/model04.yml',
    'remove MODELS/model02.yml',
  ])
  for (let count = 0; count <= moved.changes.length; count += 1) {
    expect(current(applyChanges(card, moved.changes.slice(0, count))), `after ${count} changes`).toBe('Tin Snail')
  }

  // Two models that swap places, one of them the radio's. The spare copy is of the other one, so
  // the radio's model can go to its new file, and the settings with it, before its old file is touched.
  const onPebble = setTo(card, 1)
  const swapped = done(onPebble, moveOnCard(onPebble, 1, 2))
  expect(models(swapped.card).slice(0, 2)).toEqual(['1 Gravel Cat', '2 Pebble'])
  expect(listed(swapped.changes)).toEqual([
    'write MODELS/DELETED/0001-model01.yml',
    'write MODELS/model01.yml',
    'write RADIO/radio.yml',
    'write MODELS/model00.yml',
    'remove MODELS/DELETED/0001-model01.yml',
  ])

  // Deleting the radio's model and closing up. The file the settings name is the deleted model's,
  // and the next model is to be written over it. That waits until the settings name the model the
  // radio is switching to, in its new file.
  const deleted = done(onPebble, deleteFromCard(onPebble, 1, { closeUp: true, switchTo: 3 }))
  expect(current(deleted.card)).toBe('Mudskipper')
  const order = listed(deleted.changes)
  expect(order.indexOf('write MODELS/model01.yml')).toBeLessThan(order.indexOf('write RADIO/radio.yml'))
  expect(order.indexOf('write RADIO/radio.yml')).toBeLessThan(order.indexOf('write MODELS/model00.yml'))
  for (let count = 0; count <= deleted.changes.length; count += 1) {
    const set = current(applyChanges(onPebble, deleted.changes.slice(0, count)))
    expect(['Pebble', 'Mudskipper'], `after ${count} changes`).toContain(set)
  }
})

test('wherever a list of changes stops, the settings name a file that holds the radio\'s model', () => {
  // `done` looks at the card after every change of a list. Here it is given every list the
  // actions can make on the made-up card, with the radio set to each model in turn.
  let lists = 0
  function checked<Also>(card: Card, result: CardResult<Also>): CardResult<Also> {
    if (result.ok) {
      done(card, result)
      lists += 1
    }
    return result
  }
  const taken = [1, 2, 3, 5, 6]

  for (const radioOn of taken) {
    const card = setTo(madeUp(), radioOn)

    // Every move of a model or of an empty place, to every other place nearby.
    for (let from = 1; from <= 7; from += 1) {
      for (let to = 1; to <= 7; to += 1) if (from !== to) checked(card, moveOnCard(card, from, to))
    }
    checked(card, closeUpOnCard(card))

    // Every delete, both ways. Deleting the radio's own model switches to each other model in
    // turn. Each deleted model is then brought back, with and without setting the radio to it.
    for (const position of taken) {
      for (const closeUp of [true, false]) {
        const switchChoices = position === radioOn ? taken.filter((other) => other !== position) : [undefined]
        for (const switchTo of switchChoices) {
          const gone = checked(card, deleteFromCard(card, position, { closeUp, switchTo }))
          if (!gone.ok) continue
          for (const setRadioToIt of [false, true]) {
            checked(gone.card, restoreOnCard(gone.card, gone.deletedPath, { setRadioToIt }))
          }
        }
      }
    }
  }

  // A card with no empty place: every move is a full circle, and a long one from end to end.
  const full = fullCard()
  for (const [radioOn, from, to] of [[1, 1, 60], [60, 60, 1], [30, 1, 60], [2, 1, 2], [59, 60, 59], [30, 29, 31]]) {
    const card = setTo(full, radioOn)
    checked(card, moveOnCard(card, from, to))
  }

  expect(lists).toBeGreaterThan(400)
})
