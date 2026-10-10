import { expect, test } from 'vitest'
import { controlChoices, newExtra, type ExtraAnswers } from './extras.ts'
import { controlsHeldIn, leftAloneIn } from './leftAlone.ts'
import type { Feature, Model } from './model.ts'

const steering: Feature = { kind: 'steering', control: 'wheel', port: 1, direction: 'normal', travel: 100 }
const throttle: Feature = { kind: 'throttle', control: 'trigger', port: 2, direction: 'normal', feel: 'standard', topSpeed: 100 }

const model = (extras: readonly Feature[], changes: Partial<Model> = {}): Model => ({
  id: 'm',
  position: 1,
  name: 'Crawler',
  receiverTypeId: 'dumborc-x',
  features: [steering, throttle, ...extras],
  feedback: [],
  lightColour: null,
  ...changes,
})

const preset: Feature = { kind: 'oneButtonPreset', name: 'Locked + low gear', control: 'SD' }
const presets: Feature = { kind: 'throttlePresets', control: 'SA' }
const lights: ExtraAnswers = { ...newExtra('lights', 'lights'), control: 'SB', port: 3 }
const diffLock = newExtra('frontDiffLock', 'frontDiffLock')

test('a model lists what was set up on the radio: presets, a custom throttle feel and feedback for the whole model', () => {
  expect(leftAloneIn(model([]))).toEqual([])
  expect(
    leftAloneIn(
      model([presets, preset], {
        features: [steering, { ...throttle, feel: 'custom' }, presets, preset],
        feedback: ['beeps', 'vibration'],
      }),
    ),
  ).toEqual([
    { kind: 'throttlePresets', control: 'SA' },
    { kind: 'oneButtonPreset', name: 'Locked + low gear', control: 'SD' },
    { kind: 'customThrottleFeel' },
    { kind: 'modelFeedback', feedback: ['beeps', 'vibration'] },
  ])
})

test('a control used by a setting made on the radio counts as taken, and is marked with what uses it', () => {
  const held = controlsHeldIn(model([presets, preset]))
  expect(held.map((holding) => holding.control)).toEqual(['SA', 'SD'])

  const choices = controlChoices(diffLock, 'main', [lights, diffLock], 'blankCover', held)
  const users = Object.fromEntries(
    choices
      .filter((choice) => choice.takenBy || choice.heldBy)
      .map((choice) => [choice.control.id, choice.takenBy?.kind ?? choice.heldBy?.kind]),
  )
  // SB is taken by another extra. SA and SD are held by settings the app leaves alone.
  expect(users).toEqual({ SA: 'throttlePresets', SB: 'lights', SD: 'oneButtonPreset' })
  expect(choices.find((choice) => choice.control.id === 'SD')?.heldBy).toEqual({
    kind: 'oneButtonPreset',
    name: 'Locked + low gear',
    control: 'SD',
  })
})

test('a held control cannot be freed: it stays taken when every extra is taken away', () => {
  const held = controlsHeldIn(model([preset]))
  const withExtras = controlChoices(diffLock, 'main', [lights, diffLock], 'blankCover', held)
  const withNone = controlChoices(diffLock, 'main', [diffLock], 'blankCover', held)

  expect(withExtras.find((choice) => choice.control.id === 'SB')?.takenBy).toBe(lights)
  expect(withNone.find((choice) => choice.control.id === 'SB')?.takenBy).toBeNull()
  expect(withNone.find((choice) => choice.control.id === 'SD')?.heldBy?.kind).toBe('oneButtonPreset')
  // A custom throttle feel and feedback for the whole model use no control of their own.
  expect(controlsHeldIn(model([], { feedback: ['vibration'] }))).toEqual([])
})
