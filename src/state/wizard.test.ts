import { expect, test } from 'vitest'
import { EXTRA_KINDS } from '../domain/extras.ts'
import { extraKindsFor, newWizard, VEHICLE_KINDS, withAnswers, withExtraPicked } from './wizard.ts'

// The boat list

test('a boat is not offered the two diff locks, and every other kind of vehicle is offered all ten extras', () => {
  expect(extraKindsFor('boat')).toEqual([
    'twoSpeedTransmission',
    'lights',
    'cruiseControl',
    'gyroGain',
    'dragBrake',
    'throttleSafetyLock',
    'hornSound',
    'customExtra',
  ])
  for (const kind of VEHICLE_KINDS.filter((kind) => kind !== 'boat')) {
    expect(extraKindsFor(kind)).toEqual(EXTRA_KINDS)
  }
  // Before the kind is known, nothing is held back.
  expect(extraKindsFor(null)).toHaveLength(10)
})

test('changing the kind to a boat drops a diff lock that was picked, and changing back does not return it', () => {
  let draft = withAnswers(newWizard(21).draft, { vehicleKind: 'crawler' })
  for (const kind of ['frontDiffLock', 'lights', 'rearDiffLock'] as const) draft = withExtraPicked(draft, kind).draft
  expect(draft.extras.map((extra) => extra.kind)).toEqual(['frontDiffLock', 'rearDiffLock', 'lights'])

  // Another answer changing leaves the extras alone.
  expect(withAnswers(draft, { name: 'Bouncer' }).extras).toBe(draft.extras)

  const asBoat = withAnswers(draft, { vehicleKind: 'boat' })
  expect(asBoat.extras.map((extra) => extra.kind)).toEqual(['lights'])
  // Lights keeps the receiver port it had.
  expect(asBoat.extras[0]).toBe(draft.extras[2])

  expect(withAnswers(asBoat, { vehicleKind: 'crawler' }).extras.map((extra) => extra.kind)).toEqual(['lights'])
})
