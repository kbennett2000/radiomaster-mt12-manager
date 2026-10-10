import { expect, test } from 'vitest'
import { colourStatesOf, featureFrom, newExtra, tidied, type ExtraAnswers, type ExtraKind } from './extras.ts'
import { colourFor, coloursIn, feedbackKindsOf, givesFeedback, NO_FEEDBACK, setsAColour, withColourFor } from './feedback.ts'
import type { ExtraFeedback, Model } from './model.ts'

/** An extra with some answers already given. */
const extra = (kind: ExtraKind, answers: Partial<ExtraAnswers> = {}): ExtraAnswers => ({
  ...newExtra(kind, kind),
  ...answers,
})

const gearbox = (control: ExtraAnswers['control']) => extra('twoSpeedTransmission', { control, port: 3 })
const winch = extra('customExtra', { name: 'Winch', works: 'threePositions', control: 'T5', port: 7 })

// Which states an extra has

test('an extra that is only on or off has one state to colour: on', () => {
  expect(colourStatesOf(extra('lights', { control: 'SB' }))).toEqual(['on'])
  expect(colourStatesOf(extra('lights', { control: 'SA' }))).toEqual(['on'])
  expect(colourStatesOf(extra('cruiseControl', { control: 'SC', speedControl: 'P1' }))).toEqual(['on'])
  expect(colourStatesOf(extra('customExtra', { works: 'onOff', control: 'SB' }))).toEqual(['on'])
})

test('a 2-speed transmission has low and high gear, and neutral only on the three-position switch', () => {
  expect(colourStatesOf(gearbox('SA'))).toEqual(['low', 'high', 'neutral'])
  expect(colourStatesOf(gearbox('SB'))).toEqual(['low', 'high'])
  expect(colourStatesOf(gearbox('T1'))).toEqual(['low', 'high'])
  // Before a control is picked there is no neutral to speak of.
  expect(colourStatesOf(gearbox(null))).toEqual(['low', 'high'])
})

test('a "Something else" with three positions has up, middle and down, and a dial has no states', () => {
  expect(colourStatesOf(winch)).toEqual(['up', 'middle', 'down'])
  expect(colourStatesOf(extra('gyroGain', { control: 'P1' }))).toEqual([])
  expect(colourStatesOf(extra('customExtra', { works: 'dial', control: 'P2' }))).toEqual([])
})

// A colour for each state

test('a colour is recorded for each state on its own, and every state starts with none', () => {
  const states = colourStatesOf(gearbox('SA'))
  expect(states.map((state) => colourFor(NO_FEEDBACK, state))).toEqual([null, null, null])

  let feedback = withColourFor(NO_FEEDBACK, states, 'low', 'blue')
  feedback = withColourFor(feedback, states, 'high', 'green')
  expect(coloursIn(feedback, states)).toEqual([
    { state: 'low', colour: 'blue' },
    { state: 'high', colour: 'green' },
  ])
  expect(colourFor(feedback, 'neutral')).toBeNull()

  feedback = withColourFor(feedback, states, 'neutral', 'white')
  expect(feedback.stateColours).toEqual({ low: 'blue', high: 'green', neutral: 'white' })

  // Back to None takes one colour away and leaves the others.
  feedback = withColourFor(feedback, states, 'low', null)
  expect(feedback.stateColours).toEqual({ high: 'green', neutral: 'white' })
  expect(setsAColour(feedback)).toBe(true)
})

test('an extra that is only on or off keeps its one colour where it always was', () => {
  const feedback = withColourFor(NO_FEEDBACK, ['on'], 'on', 'red')
  expect(feedback).toEqual({ sound: 'off', vibration: false, lightColour: 'red' })
  expect(withColourFor(feedback, ['on'], 'on', null)).toEqual(NO_FEEDBACK)
})

test('the colours for each state are kept on the model', () => {
  const stateColours = { low: 'blue', high: 'green', neutral: 'white' } as const
  const feedback: ExtraFeedback = { sound: 'voice', vibration: false, lightColour: null, stateColours }
  expect(featureFrom({ ...gearbox('SA'), feedback })).toEqual({
    kind: 'twoSpeedTransmission',
    control: 'SA',
    port: 3,
    feedback,
  })
  // A colour alone is feedback enough to be kept.
  const onlyAColour: ExtraFeedback = { ...NO_FEEDBACK, stateColours: { up: 'red' } }
  expect(givesFeedback(onlyAColour)).toBe(true)
  expect(featureFrom({ ...winch, feedback: onlyAColour })).toMatchObject({ feedback: onlyAColour })
})

// A colour for a state that goes away

test('the colour for neutral is dropped when the control is no longer the three-position switch', () => {
  const feedback: ExtraFeedback = {
    sound: 'beep',
    vibration: true,
    lightColour: null,
    stateColours: { low: 'blue', high: 'green', neutral: 'white' },
  }
  const onSwitch = tidied({ ...gearbox('SA'), feedback })
  expect(onSwitch.feedback).toEqual(feedback)

  const onButton = tidied({ ...onSwitch, control: 'SB' })
  expect(onButton.feedback).toEqual({ ...feedback, stateColours: { low: 'blue', high: 'green' } })
})

test('changing how a "Something else" works drops the colours for the states it no longer has', () => {
  const coloured: ExtraAnswers = {
    ...winch,
    control: 'SA',
    feedback: { ...NO_FEEDBACK, sound: 'voice', stateColours: { up: 'red', middle: 'white', down: 'blue' } },
  }
  const nowOnOff = tidied({ ...coloured, works: 'onOff' })
  expect(nowOnOff.feedback).toEqual({ sound: 'voice', vibration: false, lightColour: null })

  // And the other way round: the one colour for "on" does not carry over to three positions.
  const wasOnOff = tidied({ ...nowOnOff, feedback: { ...nowOnOff.feedback, lightColour: 'purple' } })
  expect(tidied({ ...wasOnOff, works: 'threePositions' }).feedback.lightColour).toBeNull()
})

// Feedback recorded before states had colours

test('feedback recorded before states had colours still loads, as no colour for any state', () => {
  const old: ExtraFeedback = { sound: 'voice', vibration: true, lightColour: null }
  const states = colourStatesOf(gearbox('SA'))
  expect(coloursIn(old, states)).toEqual([])
  expect(givesFeedback(old)).toBe(true)
  expect(tidied({ ...gearbox('SA'), feedback: old }).feedback).toEqual(old)
  expect(featureFrom({ ...gearbox('SA'), feedback: old })).toMatchObject({ feedback: old })
})

// The quiet line in the list

test('a colour for any one state counts as the model using light colours', () => {
  const model = (feedback: ExtraFeedback): Model => ({
    id: 'm',
    position: 1,
    name: 'Bouncer',
    receiverTypeId: 'dumborc-x',
    features: [{ kind: 'twoSpeedTransmission', control: 'SA', port: 3, feedback }],
    feedback: [],
    lightColour: null,
  })
  expect(feedbackKindsOf(model({ ...NO_FEEDBACK, sound: 'voice' }))).toEqual(['voiceCallouts'])
  expect(feedbackKindsOf(model({ ...NO_FEEDBACK, sound: 'voice', stateColours: { high: 'green' } }))).toEqual([
    'voiceCallouts',
    'ledColour',
  ])
})
