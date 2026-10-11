// The things the app does to the models on a card: rename, copy, delete, restore, move and close
// up. Each one is a function from a card to a new card. It touches no file itself. Beside the new
// card it gives the list of file changes that turns the old card into the new one, in an order
// that is safe to stop in. See changes.ts.
//
// Where a model goes is never decided here. Every question about positions is put to the rules
// in src/domain/positions.ts, which are the same rules the screens use.
//
// The radio's settings name the model the radio is set to, by the number in its file name. So
// when that model's file moves, the settings are rewritten to follow it, with a new checksum.
// When it does not move, the settings file is not written at all.

import {
  closeUpEmptyPlaces,
  modelAt,
  movePlace,
  placeForCopy,
  removeAndCloseUp,
  removeModel,
  restoreModel,
  type Placed,
} from '../domain/positions.ts'
import type { ModelNameProblem } from '../domain/modelName.ts'
import {
  deletedFrom,
  deletedPath,
  modelPath,
  nextDeletedSerial,
  PLACES,
  positionOfModelPath,
  RADIO_SETTINGS_PATH,
  readCard,
  type Card,
  type CardReading,
} from './card.ts'
import { changesBetween, type Change } from './changes.ts'
import { bytesFromDocument, documentFromBytes } from './document.ts'
import { withModelName } from './model.ts'
import { withCurrentModelNumber } from './radioSettings.ts'

/** Why the app would not do something to a card. */
export type CardProblem =
  /** The new name breaks one of the rules every model name follows. */
  | ModelNameProblem
  /** The new name has a character the file's layout cannot hold. */
  | 'cannotBeWritten'
  /** That is not one of the radio's places, which run from 1 to 60. */
  | 'noSuchPlace'
  /** No model is in that place. */
  | 'noModelThere'
  /** The model's file could not be read. It can be moved or deleted, but not renamed or copied. */
  | 'modelNotRead'
  /** Every place holds a model, so there is no room for another. */
  | 'cardFull'
  /** The radio is set to the model being deleted, and no other model was named for it to switch to. */
  | 'switchToNeeded'
  /** The settings file is missing or could not be read, so the app cannot tell which model the radio is set to. */
  | 'radioSettingsNotRead'
  /** The settings file would have to change, and its checksum is already wrong. The app does not write over that. */
  | 'checksumWrong'
  /** No deleted model is kept at that path. */
  | 'noSuchDeletedModel'

/** A new card, and the file changes that turn the old card into it. `Also` is anything else the caller is told. */
export type CardResult<Also = unknown> =
  | ({ ok: true; card: Card; changes: readonly Change[] } & Also)
  | { ok: false; problem: CardProblem }

const refuse = (problem: CardProblem): { ok: false; problem: CardProblem } => ({ ok: false, problem })

const isPlace = (position: number): boolean => Number.isInteger(position) && position >= 1 && position <= PLACES

/**
 * The models as the position rules see them. A model's id is the path its bytes are at now, which
 * is how they are found again once the rules have said where each one goes.
 */
const placedOn = (reading: CardReading): Placed[] =>
  reading.models.map((model) => ({ id: model.path, position: model.position }))

/**
 * The card with the models where the rules put them. Every model's bytes are carried to the file
 * for its new position exactly as they are. A model that came from among the deleted leaves there.
 */
function withModelsPlaced(card: Card, placed: readonly Placed[]): Map<string, Uint8Array> {
  const next = new Map(card)
  for (const path of card.keys()) {
    if (positionOfModelPath(path) !== null) next.delete(path)
  }
  for (const { id } of placed) next.delete(id)
  for (const { id, position } of placed) next.set(modelPath(position), card.get(id)!)
  return next
}

/**
 * Makes the settings follow the model the radio is set to. `current` is the id of that model, or
 * null when there is none to follow. Nothing is written when it has not moved. Gives the problem
 * when the settings would have to change and cannot be.
 */
function follow(
  next: Map<string, Uint8Array>,
  reading: CardReading,
  placed: readonly Placed[],
  current: string | null,
): CardProblem | null {
  const position = placed.find((item) => item.id === current)?.position
  if (position === undefined || position === reading.currentPosition) return null
  if (!reading.checksum?.right) return 'checksumWrong'
  const settings = withCurrentModelNumber(next.get(RADIO_SETTINGS_PATH)!, position - 1)
  if (!settings.ok) return 'radioSettingsNotRead'
  next.set(RADIO_SETTINGS_PATH, settings.bytes)
  return null
}

/** The id of the model the radio is set to, or null when it is set to an empty place. */
const currentOn = (reading: CardReading, placed: readonly Placed[]): string | null =>
  (reading.currentPosition === null ? undefined : modelAt(placed, reading.currentPosition))?.id ?? null

const done = (card: Card, next: Card): { ok: true; card: Card; changes: readonly Change[] } => ({
  ok: true,
  card: next,
  changes: changesBetween(card, next),
})

/** The bytes of a model with a new name, or the reason it cannot have one. Only the name line changes. */
function renamedBytes(bytes: Uint8Array, name: string, taken: readonly string[]): Uint8Array | CardProblem {
  const read = documentFromBytes(bytes)
  if (!read.ok) return 'modelNotRead'
  const renamed = withModelName(read.document, name, taken)
  if (renamed.ok) return bytesFromDocument(renamed.document)
  return renamed.problem === 'notAModel' ? 'modelNotRead' : renamed.problem
}

/** The names of the readable models on the card, leaving out the one in a position if one is given. */
const namesOn = (reading: CardReading, except?: number): string[] =>
  reading.models.flatMap((model) => (model.position !== except && model.name !== null ? [model.name] : []))

/** Gives the model in a position a new name. The other models on the card are the names already taken. */
export function renameOnCard(card: Card, position: number, name: string): CardResult {
  const reading = readCard(card)
  const model = reading.models.find((candidate) => candidate.position === position)
  if (!model) return refuse(isPlace(position) ? 'noModelThere' : 'noSuchPlace')
  const bytes = renamedBytes(card.get(model.path)!, name, namesOn(reading, position))
  if (typeof bytes === 'string') return refuse(bytes)
  return done(card, new Map(card).set(model.path, bytes))
}

/**
 * Copies the model in a position under a new name. The copy goes in the first empty place after
 * the original, or the first one before it when there is none after. `position` in the result is
 * where it went.
 */
export function copyOnCard(card: Card, position: number, name: string): CardResult<{ position: number }> {
  const reading = readCard(card)
  const model = reading.models.find((candidate) => candidate.position === position)
  if (!model) return refuse(isPlace(position) ? 'noModelThere' : 'noSuchPlace')
  const place = placeForCopy(placedOn(reading), position, PLACES)
  if (place === null) return refuse('cardFull')
  const bytes = renamedBytes(card.get(model.path)!, name, namesOn(reading))
  if (typeof bytes === 'string') return refuse(bytes)
  return { ...done(card, new Map(card).set(modelPath(place), bytes)), position: place }
}

export interface DeleteChoices {
  /** True to move every place after the model up by one. False to leave its place empty. */
  closeUp: boolean
  /** The position of the model the radio should switch to. Needed when the radio is set to the model being deleted. */
  switchTo?: number
}

/**
 * Deletes the model in a position. Its file is not destroyed: its bytes are kept among the
 * deleted models, at `deletedPath` in the result, so it can be brought back.
 */
export function deleteFromCard(card: Card, position: number, choices: DeleteChoices): CardResult<{ deletedPath: string }> {
  const reading = readCard(card)
  if (reading.currentPosition === null) return refuse('radioSettingsNotRead')
  const placed = placedOn(reading)
  const model = modelAt(placed, position)
  if (!model) return refuse(isPlace(position) ? 'noModelThere' : 'noSuchPlace')

  // The radio cannot be left set to a model that is gone.
  let current = currentOn(reading, placed)
  if (current === model.id) {
    const other = choices.switchTo === undefined || choices.switchTo === position ? undefined : modelAt(placed, choices.switchTo)
    if (!other) return refuse('switchToNeeded')
    current = other.id
  }

  const remaining = choices.closeUp ? removeAndCloseUp(placed, model.id, PLACES) : removeModel(placed, model.id)
  const next = withModelsPlaced(card, remaining)
  const kept = deletedPath(nextDeletedSerial(card.keys()), position)
  next.set(kept, card.get(model.id)!)
  const problem = follow(next, reading, remaining, current)
  return problem ? refuse(problem) : { ...done(card, next), deletedPath: kept }
}

export interface RestoreChoices {
  /**
   * True to set the radio to the model as it comes back. Restoring a model does not do that by
   * itself. It is what puts a card back exactly as it was when the radio was set to the model
   * that was deleted.
   */
  setRadioToIt?: boolean
}

/**
 * Brings a deleted model back to the position it was deleted from. If that place has been taken
 * since, the models after it make room, by the rules for that. `position` in the result is where
 * it is again.
 */
export function restoreOnCard(card: Card, path: string, choices: RestoreChoices = {}): CardResult<{ position: number }> {
  const reading = readCard(card)
  if (reading.currentPosition === null) return refuse('radioSettingsNotRead')
  const from = card.has(path) ? deletedFrom(path) : null
  if (!from) return refuse('noSuchDeletedModel')
  const placed = placedOn(reading)
  const restored = restoreModel(placed, { id: path, position: from.cameFrom }, PLACES)
  if (!restored) return refuse('cardFull')

  const next = withModelsPlaced(card, restored.models)
  const current = choices.setRadioToIt ? path : currentOn(reading, placed)
  const problem = follow(next, reading, restored.models, current)
  return problem ? refuse(problem) : { ...done(card, next), position: from.cameFrom }
}

/**
 * Moves whatever is in a place, a model or nothing, to another place. Everything between the two
 * shifts one place toward where it came from.
 */
export function moveOnCard(card: Card, from: number, to: number): CardResult {
  const reading = readCard(card)
  if (reading.currentPosition === null) return refuse('radioSettingsNotRead')
  if (!isPlace(from) || !isPlace(to)) return refuse('noSuchPlace')
  const placed = placedOn(reading)
  const moved = movePlace(placed, from, to, PLACES)
  const next = withModelsPlaced(card, moved)
  const problem = follow(next, reading, moved, currentOn(reading, placed))
  return problem ? refuse(problem) : done(card, next)
}

/** Removes every empty place that has a model after it. The models keep their order. */
export function closeUpOnCard(card: Card): CardResult {
  const reading = readCard(card)
  if (reading.currentPosition === null) return refuse('radioSettingsNotRead')
  const placed = placedOn(reading)
  const closed = closeUpEmptyPlaces(placed)
  const next = withModelsPlaced(card, closed)
  const problem = follow(next, reading, closed, currentOn(reading, placed))
  return problem ? refuse(problem) : done(card, next)
}
