// Where models sit in the radio's list of numbered places, and the rules for changing that.
// The rules copy what the radio itself does. They are written down in docs/adr/0002-model-positions.md.
//
// A position is data on each model, never its index in an array. That is what lets a place be empty.
// Every function here returns a new list in position order and leaves the one it was given alone.

import { MT12 } from './catalog.ts'
import type { Model, ModelId } from './model.ts'

const PLACES = MT12.maxModels

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

/**
 * Where a deleted model goes when it comes back: its old place if that is still empty,
 * otherwise wherever a copy made from that place would go.
 */
export function placeForRestore(
  models: readonly Model[],
  oldPosition: number,
  places: number = PLACES,
): number | null {
  return modelAt(models, oldPosition) ? firstEmptyAfter(models, oldPosition, places) : oldPosition
}

/** Puts a model into a place. The place must be empty. */
export const placeModel = (models: readonly Model[], model: Model, position: number): Model[] =>
  byPosition([...models, { ...model, position }])

/** Takes a model out. Its place is left empty and nothing else moves. */
export const removeModel = (models: readonly Model[], modelId: ModelId): Model[] =>
  byPosition(models.filter((model) => model.id !== modelId))

/**
 * How far a model shifts when another one moves from `from` to `to`: one place toward `from`
 * if it sits between the two, otherwise not at all.
 */
function shiftFor(position: number, from: number, to: number): number {
  if (from < to && position > from && position <= to) return -1
  if (from > to && position >= to && position < from) return 1
  return 0
}

/**
 * Moves a model to another place, the way the radio's own Move does. Everything between the two
 * places shifts one place toward where the model came from. Empty places shift along with the
 * models, because a model only ever changes position by that one step.
 */
export function moveModel(
  models: readonly Model[],
  modelId: ModelId,
  to: number,
  places: number = PLACES,
): Model[] {
  const moving = models.find((model) => model.id === modelId)
  if (!moving || !Number.isInteger(to) || to < 1 || to > places) return byPosition(models)
  const from = moving.position
  return byPosition(
    models.map((model) =>
      model.id === modelId
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

export function describeMove(models: readonly Model[], modelId: ModelId, to: number): MoveEffect {
  const moving = models.find((model) => model.id === modelId)
  const from = moving?.position ?? to
  return {
    occupant: models.find((model) => model.position === to && model.id !== modelId) ?? null,
    shifted: byPosition(
      models.filter((model) => model.id !== modelId && shiftFor(model.position, from, to) !== 0),
    ),
    direction: from < to ? 'up' : 'down',
  }
}
