import { expect, test } from 'vitest'
import {
  controlChoices,
  newExtra,
  portChoices,
  problemsInExtra,
  suggestedPort,
  type BasicPorts,
  type ExtraAnswers,
  type ExtraKind,
} from './extras.ts'
import type { BaseFitting } from './radio.ts'

const basics: BasicPorts = { steeringPort: 1, throttlePort: 2 }

/** An extra with some answers already given. */
const extra = (kind: ExtraKind, answers: Partial<ExtraAnswers> = {}): ExtraAnswers => ({
  ...newExtra(kind, kind),
  ...answers,
})

/** The controls offered to an extra, as their ids. */
const offered = (
  asking: ExtraAnswers,
  role: 'main' | 'speed' = 'main',
  others: readonly ExtraAnswers[] = [],
  baseFitting: BaseFitting = 'blankCover',
): string[] => controlChoices(asking, role, [asking, ...others], baseFitting).map((choice) => choice.control.id)

const switchesAndButtons = ['SA', 'SB', 'SC', 'SD', 'T1', 'T2', 'T3', 'T4', 'T5']

// Which kinds of control each extra accepts

test('an on and off extra accepts the switch, the push buttons and the button pairs, but no dial', () => {
  expect(offered(extra('lights'))).toEqual(switchesAndButtons)
  expect(offered(extra('frontDiffLock'))).toEqual(switchesAndButtons)
  expect(offered(extra('throttleSafetyLock'))).toEqual(switchesAndButtons)
  expect(offered(extra('twoSpeedTransmission'))).toEqual(switchesAndButtons)
})

test('gyro gain and drag brake accept dials only', () => {
  expect(offered(extra('gyroGain'))).toEqual(['P1', 'P2'])
  expect(offered(extra('dragBrake'))).toEqual(['P1', 'P2'])
})

test('horn sound accepts a push button or a button pair, not the switch', () => {
  expect(offered(extra('hornSound'))).toEqual(['SB', 'SC', 'SD', 'T1', 'T2', 'T3', 'T4', 'T5'])
})

test('a "Something else" is offered controls only once it says how it works, and they fit that', () => {
  expect(offered(extra('customExtra'))).toEqual([])
  expect(offered(extra('customExtra', { works: 'threePositions' }))).toEqual(['SA', 'T1', 'T2', 'T3', 'T4', 'T5'])
  expect(offered(extra('customExtra', { works: 'dial' }))).toEqual(['P1', 'P2'])
  expect(offered(extra('customExtra', { works: 'onOff' }))).toEqual(switchesAndButtons)
})

test('a base fitting adds its own controls: two more switches, or two more dials', () => {
  expect(offered(extra('lights'), 'main', [], 'twoSwitches')).toEqual([
    ...switchesAndButtons,
    'baseSwitchLeft',
    'baseSwitchRight',
  ])
  expect(offered(extra('gyroGain'), 'main', [], 'joystick')).toEqual([
    'P1',
    'P2',
    'joystickLeftRight',
    'joystickUpDown',
  ])
})

// The cruise control exception

test('cruise control uses two controls: a push button or two-position switch, and a dial', () => {
  const cruise = extra('cruiseControl')
  expect(offered(cruise, 'main')).toEqual(['SB', 'SC', 'SD'])
  expect(offered(cruise, 'main', [], 'twoSwitches')).toEqual(['SB', 'SC', 'SD', 'baseSwitchLeft', 'baseSwitchRight'])
  expect(offered(cruise, 'speed')).toEqual(['P1', 'P2'])

  expect(problemsInExtra(cruise)).toEqual(['controlMissing', 'speedControlMissing'])
  expect(problemsInExtra({ ...cruise, control: 'SC' })).toEqual(['speedControlMissing'])
  expect(problemsInExtra({ ...cruise, control: 'SC', speedControl: 'P1' })).toEqual([])
})

// Taken controls

test('a control another extra uses is still listed, marked with what uses it', () => {
  const lights = extra('lights', { control: 'SB', port: 3 })
  const cruise = extra('cruiseControl', { control: 'SC', speedControl: 'P1' })
  const diffLock = extra('frontDiffLock')
  const all = [lights, cruise, diffLock]

  const taken = (choices: ReturnType<typeof controlChoices>) =>
    Object.fromEntries(choices.filter((choice) => choice.takenBy).map((choice) => [choice.control.id, choice.takenBy?.kind]))

  // Both of cruise control's controls count as taken.
  expect(taken(controlChoices(diffLock, 'main', all, 'blankCover'))).toEqual({ SB: 'lights', SC: 'cruiseControl' })
  expect(taken(controlChoices(extra('gyroGain'), 'main', all, 'blankCover'))).toEqual({ P1: 'cruiseControl' })
  // An extra's own control is not taken from itself.
  expect(taken(controlChoices(lights, 'main', all, 'blankCover'))).toEqual({ SC: 'cruiseControl' })
})

// Port clashes

test('a port in use is marked with what uses it: steering, throttle or another extra', () => {
  const lights = extra('lights', { control: 'SB', port: 4 })
  const diffLock = extra('frontDiffLock')
  const choices = portChoices(diffLock, [lights, diffLock], { steeringPort: 3, throttlePort: 2 })

  expect(choices.map((choice) => choice.port)).toEqual([3, 4, 5, 6, 7, 8])
  expect(choices[0].takenBy).toEqual({ what: 'steering' })
  expect(choices[1].takenBy).toEqual({ what: 'extra', extra: lights })
  expect(choices[2].takenBy).toBeNull()
  // An extra's own port is not taken from itself.
  expect(portChoices(lights, [lights, diffLock], basics)[1].takenBy).toBeNull()
})

// The suggested port

test('a new extra is suggested the lowest free port', () => {
  expect(suggestedPort('lights', [], basics, null)).toBe(3)
  expect(suggestedPort('lights', [extra('frontDiffLock', { port: 3 }), extra('rearDiffLock', { port: 4 })], basics, null)).toBe(5)
  // Extras that live in the radio use no port.
  expect(suggestedPort('hornSound', [], basics, null)).toBeNull()
})

test('gyro gain is suggested port 8 on a receiver that expects it there, if that port is free', () => {
  expect(suggestedPort('gyroGain', [], basics, 'dumborc-x')).toBe(8)
  expect(suggestedPort('gyroGain', [], basics, 'radiolink')).toBe(8)
  expect(suggestedPort('gyroGain', [], basics, 'spektrum-dsmr')).toBe(3)
  expect(suggestedPort('gyroGain', [extra('lights', { port: 8 })], basics, 'dumborc-x')).toBe(3)
})

// What is still missing

test('a "Something else" needs a name of 20 characters at most, a way of working, a control and a port', () => {
  expect(problemsInExtra(extra('customExtra'))).toEqual(['nameMissing', 'worksMissing', 'portMissing'])
  expect(problemsInExtra(extra('customExtra', { name: 'A name that is far too long', works: 'dial' }))).toEqual([
    'nameTooLong',
    'controlMissing',
    'portMissing',
  ])
  expect(problemsInExtra(extra('customExtra', { name: 'Winch', works: 'threePositions', control: 'T5', port: 7 }))).toEqual([])
})
