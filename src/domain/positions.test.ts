import { expect, test } from 'vitest'
import type { Model } from './model.ts'
import { emptyPositions, moveModel, placeForCopy, placeForRestore, removeModel } from './positions.ts'

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

/** Which model is in which place, as "place:id" pairs, so a whole list reads at a glance. */
const places = (models: readonly Model[]): string =>
  models.map((model) => `${model.position}:${model.id}`).join(' ')

test('moving a model down shifts the ones between up by one place', () => {
  expect(places(moveModel(at(1, 2, 3, 4), 'm1', 3))).toBe('1:m2 2:m3 3:m1 4:m4')
})

test('moving a model up shifts the ones between down by one place', () => {
  expect(places(moveModel(at(1, 2, 3, 4), 'm4', 2))).toBe('1:m1 2:m4 3:m2 4:m3')
})

test('moving across an empty place shifts the empty place too', () => {
  // Place 3 is empty. Moving m1 to place 4 carries the gap up to place 2.
  const moved = moveModel(at(1, 2, 4, 5), 'm1', 4, 5)
  expect(places(moved)).toBe('1:m2 3:m4 4:m1 5:m5')
  expect(emptyPositions(moved, 5)).toEqual([2])
})

test('moving into an empty place shifts the models between and the gap', () => {
  // Place 3 is empty. Moving m5 into it pushes m4 down, and the gap follows to place 4.
  const moved = moveModel(at(1, 2, 4, 5), 'm5', 3, 5)
  expect(places(moved)).toBe('1:m1 2:m2 3:m5 5:m4')
  expect(emptyPositions(moved, 5)).toEqual([4])
})

test('deleting a model leaves its place empty and moves nothing else', () => {
  const left = removeModel(at(1, 2, 3, 4), 'm2')
  expect(places(left)).toBe('1:m1 3:m3 4:m4')
  expect(emptyPositions(left, 4)).toEqual([2])
})

test('a copy lands in the first empty place after the original', () => {
  expect(placeForCopy(at(1, 2, 3, 5, 6), 2, 8)).toBe(4)
})

test('a copy with nothing empty after it lands in the lowest empty place before it', () => {
  // Places 1 and 3 are empty and everything from 4 up is taken. The original is in place 5.
  expect(placeForCopy(at(2, 4, 5, 6), 5, 6)).toBe(1)
})

test('a copy has nowhere to go when the radio is full', () => {
  expect(placeForCopy(at(1, 2, 3), 2, 3)).toBeNull()
})

test('a restored model goes back to its old place when that is still empty', () => {
  expect(placeForRestore(at(1, 2, 4), 3, 6)).toBe(3)
})

test('a restored model whose old place is taken goes to the first empty place after it', () => {
  expect(placeForRestore(at(1, 2, 3, 4), 3, 6)).toBe(5)
})
