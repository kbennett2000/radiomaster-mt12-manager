// For reviewers only, and not part of the product: the made-up cards the "Real card" links open.
//
// Every one is built from the made-up card under src/files/testdata/card, with small changes.
// Nothing here comes from a real radio.

import { modelPath, RADIO_SETTINGS_PATH, type Card } from '../files/card.ts'
import { bytesFromDocument, bytesFromText, documentFromBytes } from '../files/document.ts'
import { withModelName } from '../files/model.ts'
import { withCurrentModelNumber } from '../files/radioSettings.ts'
import type { ReviewCard } from '../state/scenarios.ts'

const FOLDER = '../files/testdata/card/'

// The made-up card's files, exactly as they are on disk.
const texts = import.meta.glob<string>('../files/testdata/card/**', { query: '?raw', import: 'default', eager: true })

const madeUp: Card = new Map(
  Object.entries(texts).map(([file, text]) => [file.slice(FOLDER.length), bytesFromText(text)]),
)

/** The made-up files are plain text. */
const textOf = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const README_FILES = [...madeUp].filter(([path]) => path.endsWith('.txt'))

/** One of the made-up card's five model files, by the position it has there. */
function madeUpModel(position: number): Uint8Array {
  const bytes = madeUp.get(modelPath(position))
  if (!bytes) throw new Error(`The made-up card has no model in position ${position}.`)
  return bytes
}

/** A model's file under another name. */
function named(bytes: Uint8Array, name: string): Uint8Array {
  const read = documentFromBytes(bytes)
  const renamed = read.ok ? withModelName(read.document, name) : null
  if (!renamed?.ok) throw new Error(`A made-up model could not be named ${name}.`)
  return bytesFromDocument(renamed.document)
}

/** The made-up settings with the radio set to another position. */
function settingsOn(position: number): Uint8Array {
  const set = withCurrentModelNumber(madeUp.get(RADIO_SETTINGS_PATH)!, position - 1)
  if (!set.ok) throw new Error('The made-up settings could not be changed.')
  return set.bytes
}

/** A card with a model in each of these positions, and the radio set to one of them. */
function cardWith(models: readonly (readonly [position: number, bytes: Uint8Array])[], radioOn: number): Card {
  return new Map([
    ...README_FILES,
    ...models.map(([position, bytes]) => [modelPath(position), bytes] as const),
    [RADIO_SETTINGS_PATH, settingsOn(radioOn)],
  ])
}

// The four made-up models whose receiver type is in the app's list, and the one whose is not.
const KNOWN = [1, 2, 3, 6].map(madeUpModel)
const NOT_KNOWN = madeUpModel(5)

const TWENTY_NAMES = [
  'Pebble',
  'Gravel Cat',
  'Mudskipper',
  'Bog Hopper',
  'Dust Moth',
  'Rock Wren',
  'Sand Flea',
  'Fen Otter',
  'Moss Toad',
  'Clay Crab',
  'Reed Vole',
  'Ash Newt',
  'Bramble',
  'Cinder',
  'Thistle',
  'Puddle',
  'Nettle',
  'Burdock',
  'Cobble',
  'Marsh Hen',
]

/** Models with these names in these positions, taking turns with the four known receiver types. */
const inPositions = (positions: readonly number[]): [number, Uint8Array][] =>
  positions.map((position, index) => [position, named(KNOWN[index % KNOWN.length], TWENTY_NAMES[index])])

/** A model's file with one line that does not end the way the radio ends a line. */
function withABadLine(bytes: Uint8Array, line: number): Uint8Array {
  const lines = textOf(bytes).split('\r\n')
  return bytesFromText(`${lines.slice(0, line).join('\r\n')}\n${lines.slice(line).join('\r\n')}`)
}

/** The made-up settings with a check number on the first line that is not the right one. */
function withAWrongCheck(bytes: Uint8Array): Uint8Array {
  return bytesFromText(textOf(bytes).replace(/^checksum: \d+/, 'checksum: 4242'))
}

const cards: Record<ReviewCard, () => Card> = {
  madeUp: () => madeUp,
  twentyModels: () => cardWith(inPositions(Array.from({ length: 20 }, (_, index) => index + 1)), 20),
  emptyPlace: () => cardWith(inPositions([1, 2, 3, 4, 6, 7, 8]), 2),
  unknownReceiver: () => cardWith([...inPositions([1, 2, 3]), [4, NOT_KNOWN]], 1),
  unreadableModel: () => {
    const models = inPositions([1, 2, 3, 4, 5])
    models[2] = [3, withABadLine(models[2][1], 7)]
    return cardWith(models, 4)
  },
  wrongChecksum: () => new Map(madeUp).set(RADIO_SETTINGS_PATH, withAWrongCheck(madeUp.get(RADIO_SETTINGS_PATH)!)),
  noModelsFolder: () => new Map([...madeUp].filter(([path]) => !path.startsWith('MODELS/'))),
}

/** The files of one of the reviewer's made-up cards: each path from the top of the card, and its bytes. */
export const reviewCard = (card: ReviewCard): Card => cards[card]()
