/// <reference types="node" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { RADIO_SETTINGS_PATH, readCard, type Card } from '../files/card.ts'
import { sameBytes } from '../files/changes.ts'
import { bytesFromText } from '../files/document.ts'
import { cardFromFolder } from '../test/cardFromFolder.ts'
import { folderHolding } from '../test/folderHolding.ts'
import { readRadioFolder } from './radioFolder.ts'

// The made-up card: five invented models, the radio's settings, and one other file in each folder.
const testdata = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'files', 'testdata', 'card')
const madeUp = (): Card => cardFromFolder(testdata, ['MODELS', 'RADIO'])

const withFile = (card: Card, at: string, content = 'made up\r\n'): Card => new Map(card).set(at, bytesFromText(content))
const without = (card: Card, gone: (at: string) => boolean): Card => new Map([...card].filter(([at]) => !gone(at)))
/** The same files with one folder's name, or one file's path, spelled another way. */
const renamed = (card: Card, from: string, to: string): Card =>
  new Map([...card].map(([at, bytes]) => [at.startsWith(from) ? to + at.slice(from.length) : at, bytes]))

test('a folder that holds a card is read into the same card, file for file and byte for byte', async () => {
  const card = madeUp()
  const read = await readRadioFolder(folderHolding(card).folder)

  if (!read.ok) throw new Error(`refused: ${read.problem}`)
  expect([...read.card.keys()].toSorted()).toEqual([...card.keys()].toSorted())
  for (const [at, bytes] of card) expect(sameBytes(read.card.get(at)!, bytes), at).toBe(true)

  // What the app makes of it is what the existing reader makes of the same files.
  expect(read.reading).toEqual(readCard(card))
  expect(read.reading.models.map((model) => `${model.position} ${model.name}`)).toEqual([
    '1 Pebble',
    '2 Gravel Cat',
    '3 Mudskipper',
    '5 Tin Snail',
    '6 Bog Hopper',
  ])
  expect(read.reading.currentPosition).toBe(5)
  expect(read.reading.checksum?.right).toBe(true)
})

test('the deleted models are read too', async () => {
  const card = madeUp()
  const deleted = new Map(card).set('MODELS/DELETED/0003-model07.yml', card.get('MODELS/model00.yml')!)
  const read = await readRadioFolder(folderHolding(deleted).folder)

  if (!read.ok) throw new Error(`refused: ${read.problem}`)
  expect(read.reading.deleted.map((model) => [model.name, model.cameFrom, model.serial])).toEqual([['Pebble', 8, 3]])
  expect(read.reading.models).toHaveLength(5)
})

test('only the files in MODELS, MODELS/DELETED and RADIO are opened', async () => {
  let card = madeUp()
  const expected = [...card.keys(), 'MODELS/DELETED/0001-model02.yml'].toSorted()
  card = new Map(card).set('MODELS/DELETED/0001-model02.yml', card.get('MODELS/model02.yml')!)
  // Everything else a card can have on it: other folders, loose files, and folders inside the three.
  for (const elsewhere of [
    'model00.yml',
    'SOUNDS/en/hello.wav',
    'FIRMWARE/radio.bin',
    'MODELS/BACKUP/model00.yml',
    'MODELS/DELETED/OLDER/0001-model00.yml',
    'RADIO/BACKUP/radio.yml',
  ]) {
    card = withFile(card, elsewhere)
  }
  const { folder, opened } = folderHolding(card)
  const read = await readRadioFolder(folder)

  expect(opened.toSorted()).toEqual(expected)
  if (!read.ok) throw new Error(`refused: ${read.problem}`)
  expect([...read.card.keys()].toSorted()).toEqual(expected)
})

test('a folder with no MODELS folder, or with no RADIO/radio.yml, is the wrong folder', async () => {
  const card = madeUp()
  const wrong = { ok: false, problem: 'wrongFolder' }

  const noModels = folderHolding(without(card, (at) => at.startsWith('MODELS/')))
  expect(await readRadioFolder(noModels.folder)).toEqual(wrong)

  const noRadio = folderHolding(without(card, (at) => at.startsWith('RADIO/')))
  expect(await readRadioFolder(noRadio.folder)).toEqual(wrong)

  // RADIO is there, but the settings are not in it. No model's file is opened to find that out.
  const noSettings = folderHolding(without(card, (at) => at === RADIO_SETTINGS_PATH))
  expect(await readRadioFolder(noSettings.folder)).toEqual(wrong)
  expect(noSettings.opened.filter((at) => at.startsWith('MODELS/'))).toEqual([])

  // A folder inside the drive, picked by mistake, and a folder with nothing in it.
  expect(await readRadioFolder(folderHolding(new Map([['model00.yml', card.get('MODELS/model00.yml')!]])).folder)).toEqual(wrong)
  expect(await readRadioFolder(folderHolding(new Map()).folder)).toEqual(wrong)
})

test('names are matched exactly as the radio writes them', async () => {
  const card = madeUp()
  const wrong = { ok: false, problem: 'wrongFolder' }

  expect(await readRadioFolder(folderHolding(renamed(card, 'MODELS/', 'Models/')).folder)).toEqual(wrong)
  expect(await readRadioFolder(folderHolding(renamed(card, 'RADIO/', 'radio/')).folder)).toEqual(wrong)
  expect(await readRadioFolder(folderHolding(renamed(card, RADIO_SETTINGS_PATH, 'RADIO/Radio.yml')).folder)).toEqual(wrong)
  // A file called MODELS is not the MODELS folder.
  const modelsIsAFile = withFile(without(card, (at) => at.startsWith('MODELS/')), 'MODELS')
  expect(await readRadioFolder(folderHolding(modelsIsAFile).folder)).toEqual(wrong)

  // A folder called "deleted" is not where deleted models are kept, so it is not opened.
  const lowerCase = folderHolding(new Map(card).set('MODELS/deleted/0001-model00.yml', card.get('MODELS/model00.yml')!))
  const read = await readRadioFolder(lowerCase.folder)
  expect(read.ok && read.reading.deleted).toEqual([])
  expect(lowerCase.opened).not.toContain('MODELS/deleted/0001-model00.yml')
})

test('a card with no models on it is still a card', async () => {
  const empty = new Map([...without(madeUp(), (at) => at.startsWith('MODELS/')), ['MODELS/', new Uint8Array()]])
  const read = await readRadioFolder(folderHolding(empty).folder)

  if (!read.ok) throw new Error(`refused: ${read.problem}`)
  expect(read.reading.models).toEqual([])
  expect(read.reading.currentPosition).toBe(5)
})

test('a folder that cannot be read all the way through is refused, not half read', async () => {
  const pulledOut = folderHolding(madeUp(), ['MODELS/model02.yml'])
  expect(await readRadioFolder(pulledOut.folder)).toEqual({ ok: false, problem: 'couldNotRead' })
})
