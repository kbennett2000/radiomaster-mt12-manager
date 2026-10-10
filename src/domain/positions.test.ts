import { expect, test } from 'vitest'
import type { Model } from './model.ts'
import {
  closeUpEmptyPlaces,
  emptyPositions,
  movePlace,
  placeForCopy,
  removeAndCloseUp,
  removeModel,
  restoreModel,
} from './positions.ts'

/** Models named after the place they start in: at(1, 2, 4) gives m1, m2 and m4. */
const at = (...positions: number[]): Model[] =>
  positions.map((position) => ({
    id: `m${position}`,
    position,
    name: `Model ${position}`,
    receiverTypeId: 'spektrum-slt',
    features: [],
    feedback: [],
  }))

/** A model that is not in the list, last seen in a position. */
const deletedFrom = (position: number): Model => ({ ...at(position)[0], id: 'back' })

/** Which model is in which place, as "place:id" pairs, so a whole list reads at a glance. */
const places = (models: readonly Model[]): string =>
  models.map((model) => `${model.position}:${model.id}`).join(' ')

// Moving a model

test('moving a model down shifts the ones between up by one place', () => {
  expect(places(movePlace(at(1, 2, 3, 4), 1, 3))).toBe('1:m2 2:m3 3:m1 4:m4')
})

test('moving a model up shifts the ones between down by one place', () => {
  expect(places(movePlace(at(1, 2, 3, 4), 4, 2))).toBe('1:m1 2:m4 3:m2 4:m3')
})

test('moving a model across an empty place shifts the empty place too', () => {
  // Place 3 is empty. Moving m1 to place 4 carries the gap up to place 2.
  const moved = movePlace(at(1, 2, 4, 5), 1, 4, 5)
  expect(places(moved)).toBe('1:m2 3:m4 4:m1 5:m5')
  expect(emptyPositions(moved, 5)).toEqual([2])
})

// Moving an empty place

test('moving an empty place down shifts the models between up, and it stays empty', () => {
  // Place 2 is empty. Moving it to place 4 pulls m3 and m4 up one place each.
  const moved = movePlace(at(1, 3, 4, 5), 2, 4, 5)
  expect(places(moved)).toBe('1:m1 2:m3 3:m4 5:m5')
  expect(emptyPositions(moved, 5)).toEqual([4])
})

test('moving an empty place up shifts the models between down, and it stays empty', () => {
  // Place 4 is empty. Moving it to place 2 pushes m2 and m3 down one place each.
  const moved = movePlace(at(1, 2, 3, 5), 4, 2, 5)
  expect(places(moved)).toBe('1:m1 3:m2 4:m3 5:m5')
  expect(emptyPositions(moved, 5)).toEqual([2])
})

// Deleting

test('deleting closes up the list: everything after moves up one place, empty places included', () => {
  // Place 4 is empty. After m2 goes, m3 moves to 2, the gap moves to 3, and m5 moves to 4.
  const left = removeAndCloseUp(at(1, 2, 3, 5), 'm2', 6)
  expect(places(left)).toBe('1:m1 2:m3 4:m5')
  expect(emptyPositions(left, 6)).toEqual([3, 5, 6])
})

test('deleting the radio’s own way leaves the place empty and moves nothing else', () => {
  const left = removeModel(at(1, 2, 3, 4), 'm2')
  expect(places(left)).toBe('1:m1 3:m3 4:m4')
  expect(emptyPositions(left, 4)).toEqual([2])
})

test('closing up empty places keeps the models in order and leaves no gaps', () => {
  expect(places(closeUpEmptyPlaces(at(2, 3, 6, 9)))).toBe('1:m2 2:m3 3:m6 4:m9')
})

// Copying

test('a copy lands in the first empty place after the original', () => {
  expect(placeForCopy(at(1, 2, 3, 5, 6), 2, 8)).toBe(4)
})

test('a copy with nothing empty after it lands in the lowest empty place before it', () => {
  // Places 1 and 3 are empty and everything from 4 up is taken. The original is in place 5.
  expect(placeForCopy(at(2, 4, 5, 6), 5, 6)).toBe(1)
})

// Restoring

test('a restored model goes back to its old place when that is still empty', () => {
  const restored = restoreModel(at(1, 2, 4), deletedFrom(3), 6)
  expect(places(restored!.models)).toBe('1:m1 2:m2 3:back 4:m4')
  expect(restored!.moved).toEqual([])
})

test('a restored model whose old place is taken pushes models down as far as the next empty place', () => {
  // Place 5 is the next empty one. m2, m3 and m4 each move down one; m6 stays where it is.
  const restored = restoreModel(at(1, 2, 3, 4, 6), deletedFrom(2), 8)
  expect(places(restored!.models)).toBe('1:m1 2:back 3:m2 4:m3 5:m4 6:m6')
  expect(places(restored!.moved)).toBe('2:m2 3:m3 4:m4')
  expect(restored!.direction).toBe('down')
})

test('a restored model with nothing empty after its old place pushes models up instead', () => {
  // Place 2 is the only empty one. m3 and m4 each move up one, and the model is back in place 4.
  const restored = restoreModel(at(1, 3, 4, 5), deletedFrom(4), 5)
  expect(places(restored!.models)).toBe('1:m1 2:m3 3:m4 4:back 5:m5')
  expect(restored!.direction).toBe('up')
})

test('a model cannot be restored to a full radio', () => {
  expect(restoreModel(at(1, 2, 3), deletedFrom(2), 3)).toBeNull()
})
