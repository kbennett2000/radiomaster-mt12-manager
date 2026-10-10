// Where models sit in the radio's list of numbered places, and the rules for changing that.
// The rules are written down in docs/adr/0002-model-positions.md.
//
// A position is data on each model, never its index in an array. That is what lets a place be empty.
// Every function here returns a new list in position order and leaves the one it was given alone.

import { MT12 } from './catalog.ts'
import type { Model, ModelId } from './model.ts'

const PLACES = MT12.maxModels

/** What happens to the rest of the list when a model is deleted. The owner chooses in Radio setup. */
export type WhenDeleting = 'closeUp' | 'leaveEmpty'

/** The same models, lowest position first. */
export const byPosition = (models: readonly Model[]): Model[] =>
  models.toSorted((first, second) => first.position - second.position)

/** The model in a place, or undefined when the place is empty. */
export const modelAt = (models: readonly Model[], position: number): Model | undefined =>
  models.find((model) => model.position === position)

/** Every empty place, lowest first. */
export function emptyPositions(models: readonly Model[], places: number = PLACES): number[] {
  const taken = new Set(models.map((model) => model.position))
  const empty: number[] = []
  for (let position = 1; position <= places; position++) {
    if (!taken.has(position)) empty.push(position)
  }
  return empty
}

/** The lowest-numbered empty place, or null when the radio is full. "Add a model" uses this. */
export const firstEmptyPosition = (models: readonly Model[], places: number = PLACES): number | null =>
  emptyPositions(models, places)[0] ?? null

/** The highest position that holds a model, or 0 when there are no models. */
export const lastTakenPosition = (models: readonly Model[]): number =>
  models.reduce((last, model) => Math.max(last, model.position), 0)

/** True when at least one empty place has a model somewhere after it. */
export const hasEmptyPlacesToCloseUp = (models: readonly Model[]): boolean =>
  lastTakenPosition(models) > models.length

/** The models that sit after a position, lowest first. */
export const modelsAfter = (models: readonly Model[], position: number): Model[] =>
  byPosition(models.filter((model) => model.position > position))

/**
 * The first empty place after a position. If there is none after it, the lowest-numbered empty
 * place before it, as if the search wrapped round to the start. Null when the radio is full.
 */
export function firstEmptyAfter(
  models: readonly Model[],
  position: number,
  places: number = PLACES,
): number | null {
  const empty = emptyPositions(models, places)
  return empty.find((place) => place > position) ?? empty.find((place) => place < position) ?? null
}

/** Where a copy of the model in `originalPosition` goes. */
export const placeForCopy = firstEmptyAfter

/** Puts a model into a place. The place must be empty. */
export const placeModel = (models: readonly Model[], model: Model, position: number): Model[] =>
  byPosition([...models, { ...model, position }])

/**
 * How far a model shifts when whatever is in `from` moves to `to`: one place toward `from`
 * if it sits between the two, otherwise not at all.
 */
function shiftFor(position: number, from: number, to: number): number {
  if (from < to && position > from && position <= to) return -1
  if (from > to && position >= to && position < from) return 1
  return 0
}

const isPlace = (position: number, places: number): boolean =>
  Number.isInteger(position) && position >= 1 && position <= places

/**
 * Moves whatever is in a place, a model or nothing, to another place. Everything between the two
 * places shifts one place toward where it came from. Empty places shift along with the models,
 * because a model only ever changes position by that one step. Moving an empty place this way
 * leaves the place it lands in empty.
 */
export function movePlace(
  models: readonly Model[],
  from: number,
  to: number,
  places: number = PLACES,
): Model[] {
  if (!isPlace(from, places) || !isPlace(to, places)) return byPosition(models)
  return byPosition(
    models.map((model) =>
      model.position === from
        ? { ...model, position: to }
        : { ...model, position: model.position + shiftFor(model.position, from, to) },
    ),
  )
}

/** What a move would do, described before it happens. */
export interface MoveEffect {
  /** The model in the target place now, or null when that place is empty. */
  occupant: Model | null
  /** The other models that would change place, as they stand now, lowest position first. */
  shifted: Model[]
  /** Which way those models go: 'up' is toward position 1. */
  direction: 'up' | 'down'
}

export function describeMove(models: readonly Model[], from: number, to: number): MoveEffect {
  return {
    occupant: from === to ? null : (modelAt(models, to) ?? null),
    shifted: byPosition(models.filter((model) => shiftFor(model.position, from, to) !== 0)),
    direction: from < to ? 'up' : 'down',
  }
}

/** Takes a model out and leaves its place empty. Nothing else moves. This is what the radio itself does. */
export const removeModel = (models: readonly Model[], modelId: ModelId): Model[] =>
  byPosition(models.filter((model) => model.id !== modelId))

/**
 * Takes a model out and closes up the list: every place after it, models and empty places alike,
 * moves up one place.
 */
export function removeAndCloseUp(
  models: readonly Model[],
  modelId: ModelId,
  places: number = PLACES,
): Model[] {
  const gone = models.find((model) => model.id === modelId)
  if (!gone) return byPosition(models)
  // Moving the place it left empty to the very end shifts everything after it up by one.
  return movePlace(removeModel(models, modelId), gone.position, places, places)
}

/** Removes every empty place that has a model after it. The models keep their order. */
export const closeUpEmptyPlaces = (models: readonly Model[]): Model[] =>
  byPosition(models).map((model, index) => ({ ...model, position: index + 1 }))

/** What bringing a deleted model back did. */
export interface Restored {
  models: Model[]
  /** The models that had to move to make room, as they stood before, lowest position first. */
  moved: Model[]
  /** Which way they moved: 'down' is away from position 1. */
  direction: 'up' | 'down'
}

/**
 * Brings a deleted model back to the position it was deleted from.
 *
 * If that place is taken, the models from there down to the next empty place each move down one
 * place. If nothing is empty after it, the models between the nearest empty place before it and
 * that position each move up one place instead. Either way the model is back where it was.
 * Returns null when the radio is full.
 */
export function restoreModel(
  models: readonly Model[],
  model: Model,
  places: number = PLACES,
): Restored | null {
  const position = model.position
  if (!modelAt(models, position)) {
    return { models: placeModel(models, model, position), moved: [], direction: 'down' }
  }
  const empty = emptyPositions(models, places)
  const room = empty.find((place) => place > position) ?? empty.findLast((place) => place < position)
  if (room === undefined) return null
  // Moving that empty place to the old position shifts every model between them one place toward it.
  const effect = describeMove(models, room, position)
  return {
    models: placeModel(movePlace(models, room, position, places), model, position),
    moved: effect.shifted,
    direction: effect.direction,
  }
}
