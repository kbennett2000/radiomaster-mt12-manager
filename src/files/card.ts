// The radio's card as a set of files, and what the app reads from it.
//
// A card here is nothing but files: a path from the top of the card, and the bytes at that path.
// The app looks at two folders:
//
//   MODELS/modelNN.yml   one model. NN is two digits from 00 to 59. Position 1 in the app is
//                        model00.yml and position 60 is model59.yml. A number with no file is an
//                        empty place.
//   RADIO/radio.yml      the radio's settings. Its `currModel` line holds the NN of the model the
//                        radio is set to.
//   MODELS/DELETED/      where the app keeps a model it has deleted, so it can be brought back.
//                        The radio does not look in here.
//
// Anything else in those folders, and everything outside them, is left exactly as it is.

import { MT12, receiverTypeForNumbers, type ReceiverTypeId } from '../domain/catalog.ts'
import { documentFromBytes, type Refusal } from './document.ts'
import { modelNameOf, receiverNumbersOf } from './model.ts'
import { checksumOf, currentModelNumberOf, type Checksum } from './radioSettings.ts'

/** A set of files: each path, with "/" between folders, and the bytes there. No path is there twice. */
export type Card = ReadonlyMap<string, Uint8Array>

/** Puts things with a path in the order of their paths, the same way on every computer. */
export function byPath<Item extends { path: string }>(first: Item, second: Item): number {
  if (first.path === second.path) return 0
  return first.path < second.path ? -1 : 1
}

/** How many places the radio has for models. */
export const PLACES = MT12.maxModels

const MODELS = 'MODELS'
const RADIO = 'RADIO'
const DELETED = `${MODELS}/DELETED`
export const RADIO_SETTINGS_PATH = `${RADIO}/radio.yml`

const MODEL_FILE = /^MODELS\/model(\d\d)\.yml$/
const DELETED_FILE = /^MODELS\/DELETED\/(\d{4,})-model(\d\d)\.yml$/

const twoDigits = (number: number): string => String(number).padStart(2, '0')

/** The file that holds the model in a position, counted from 1. */
export const modelPath = (position: number): string => `${MODELS}/model${twoDigits(position - 1)}.yml`

/** The position a path is the model file for, or null when the path is not a model's file. */
export function positionOfModelPath(path: string): number | null {
  const number = Number(MODEL_FILE.exec(path)?.[1] ?? Number.NaN)
  return number < PLACES ? number + 1 : null
}

/**
 * The file a deleted model is kept in. The name starts with a number that is one higher than any
 * deleted model before it, so no two can ever have the same name and they sort in the order they
 * were deleted. After it comes the model file it was taken from, which records its position.
 */
export const deletedPath = (serial: number, cameFrom: number): string =>
  `${DELETED}/${String(serial).padStart(4, '0')}-model${twoDigits(cameFrom - 1)}.yml`

/** What a deleted model's path says about it, or null when the path is not one. */
export function deletedFrom(path: string): { serial: number; cameFrom: number } | null {
  const match = DELETED_FILE.exec(path)
  if (!match || Number(match[2]) >= PLACES) return null
  return { serial: Number(match[1]), cameFrom: Number(match[2]) + 1 }
}

/** The number for the next deleted model's file: one more than the highest among these paths. */
export const nextDeletedSerial = (paths: Iterable<string>): number =>
  Math.max(0, ...Array.from(paths, (path) => deletedFrom(path)?.serial ?? 0)) + 1

/** What the app reads from one model's file. */
interface ModelFile {
  path: string
  /** Null when the file could not be read as a model. */
  name: string | null
  /** The two numbers that pick the receiver type. Null when the file does not have them. */
  receiverNumbers: readonly [number, number] | null
  /** The receiver type those numbers are in the app's list. Null when the list does not have them. */
  receiverTypeId: ReceiverTypeId | null
  /** Why the reader refused the file. Null when it read it. */
  refusal: Refusal | null
}

/** A model on the card. One whose file could not be read still holds its position. */
export interface CardModel extends ModelFile {
  /** Its position, counted from 1. */
  position: number
}

/** A model the app deleted, kept so it can be brought back. */
export interface DeletedModel extends ModelFile {
  /** The position it was deleted from. */
  cameFrom: number
  /** Higher for a model deleted later. */
  serial: number
}

/** A file the reader refused, with the line it stopped at and why. */
export interface RefusedFile extends Refusal {
  path: string
}

/** What the app makes of a card. */
export interface CardReading {
  /** The models, lowest position first. */
  models: readonly CardModel[]
  /** The deleted models, the one deleted last first. */
  deleted: readonly DeletedModel[]
  /**
   * The position the radio is set to, counted from 1. Null when the settings file is missing,
   * could not be read, or does not name one of the radio's places. It can be an empty place.
   */
  currentPosition: number | null
  /** The settings file's checksum. Null when the file is missing or could not be read. */
  checksum: Checksum | null
  /** Every file that could not be read. */
  refused: readonly RefusedFile[]
  /** Every other file in the two folders. The app leaves them alone. */
  others: readonly string[]
}

function readModelFile(path: string, bytes: Uint8Array): ModelFile {
  const read = documentFromBytes(bytes)
  if (!read.ok) {
    return { path, name: null, receiverNumbers: null, receiverTypeId: null, refusal: { line: read.line, reason: read.reason } }
  }
  const receiverNumbers = receiverNumbersOf(read.document)
  return {
    path,
    name: modelNameOf(read.document),
    receiverNumbers,
    receiverTypeId: receiverNumbers ? receiverTypeForNumbers(...receiverNumbers) : null,
    refusal: null,
  }
}

/** Reads a card: its models by position, the model the radio is set to, and what could not be read. */
export function readCard(card: Card): CardReading {
  const models: CardModel[] = []
  const deleted: DeletedModel[] = []
  const others: string[] = []
  let currentPosition: number | null = null
  let checksum: Checksum | null = null
  const refused: RefusedFile[] = []

  for (const [path, bytes] of card) {
    const position = positionOfModelPath(path)
    const from = deletedFrom(path)
    if (position !== null) {
      models.push({ position, ...readModelFile(path, bytes) })
    } else if (from) {
      deleted.push({ ...from, ...readModelFile(path, bytes) })
    } else if (path === RADIO_SETTINGS_PATH) {
      const read = documentFromBytes(bytes)
      if (read.ok) {
        const number = currentModelNumberOf(read.document)
        currentPosition = number !== null && number < PLACES ? number + 1 : null
        checksum = checksumOf(read.document)
      } else {
        refused.push({ path, line: read.line, reason: read.reason })
      }
    } else if (path.startsWith(`${MODELS}/`) || path.startsWith(`${RADIO}/`)) {
      others.push(path)
    }
  }

  for (const file of [...models, ...deleted]) {
    if (file.refusal) refused.push({ path: file.path, ...file.refusal })
  }
  return {
    models: models.toSorted((first, second) => first.position - second.position),
    deleted: deleted.toSorted((first, second) => second.serial - first.serial),
    currentPosition,
    checksum,
    refused: refused.toSorted(byPath),
    others: others.toSorted(),
  }
}
