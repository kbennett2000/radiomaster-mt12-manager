// The feedback a radio gives for a model: beeps, voice, vibration and the colour of its lights.

import type { LightColour } from './catalog.ts'
import type { Working } from './extras.ts'
import type { ExtraFeedback, ExtraState, FeedbackKind, Model } from './model.ts'
import type { ControlKind } from './radio.ts'

/** The radio does nothing extra. Every extra starts here. */
export const NO_FEEDBACK: ExtraFeedback = { sound: 'off', vibration: false, lightColour: null }

/**
 * The states the lights can show a colour for, in the order they are asked about. It follows from
 * how the extra works and the kind of control that works it. Neutral only exists on a
 * three-position switch. An extra that does not switch, such as a dial, has none.
 */
export function colourStatesFor(working: Working | null, control: ControlKind | null): readonly ExtraState[] {
  switch (working) {
    case 'onOff':
    case 'cruiseOnOff':
      return ['on']
    case 'twoSpeed':
      return control === 'switch3' ? ['low', 'high', 'neutral'] : ['low', 'high']
    case 'threePositions':
      return ['up', 'middle', 'down']
    default:
      return []
  }
}

/** The colour recorded for one state. Null leaves the lights alone in that state. */
export const colourFor = (feedback: ExtraFeedback, state: ExtraState): LightColour | null =>
  state === 'on' ? feedback.lightColour : (feedback.stateColours?.[state] ?? null)

/** One state of an extra and the colour the lights show in it. */
export interface StateColour {
  state: ExtraState
  colour: LightColour
}

/** The colours that are set, each with its state, for the states given and in their order. */
export const coloursIn = (feedback: ExtraFeedback, states: readonly ExtraState[]): StateColour[] =>
  states.flatMap((state) => {
    const colour = colourFor(feedback, state)
    return colour ? [{ state, colour }] : []
  })

/**
 * The same feedback with colours for the given states only. A colour for a state the extra does
 * not have is dropped, which is what happens when its control or its way of working changes.
 */
export function keepingColoursFor(feedback: ExtraFeedback, states: readonly ExtraState[]): ExtraFeedback {
  const { sound, vibration } = feedback
  const kept = coloursIn(feedback, states)
  const lightColour = kept.find(({ state }) => state === 'on')?.colour ?? null
  const others = kept.filter(({ state }) => state !== 'on')
  if (others.length === 0) return { sound, vibration, lightColour }
  return {
    sound,
    vibration,
    lightColour,
    stateColours: Object.fromEntries(others.map(({ state, colour }) => [state, colour])),
  }
}

/** Records the colour for one of an extra's states. Null takes it away. `states` is every state it has. */
export function withColourFor(
  feedback: ExtraFeedback,
  states: readonly ExtraState[],
  state: ExtraState,
  colour: LightColour | null,
): ExtraFeedback {
  const changed: ExtraFeedback =
    state === 'on'
      ? { ...feedback, lightColour: colour }
      : { ...feedback, stateColours: { ...feedback.stateColours, [state]: colour ?? undefined } }
  return keepingColoursFor(changed, states)
}

/** True when the feedback sets the lights to a colour in any state. */
export const setsAColour = (feedback: ExtraFeedback): boolean =>
  feedback.lightColour !== null || Object.values(feedback.stateColours ?? {}).some((colour) => colour !== undefined)

/** True when the radio does anything at all for this feedback. */
export const givesFeedback = (feedback: ExtraFeedback): boolean =>
  feedback.sound !== 'off' || feedback.vibration || setsAColour(feedback)

// The order the kinds are listed in.
const KINDS: readonly FeedbackKind[] = ['voiceCallouts', 'beeps', 'vibration', 'ledColour']

/**
 * Every kind of feedback a model uses, whether it is set for the model as a whole or for one of
 * its features. Older models only have the first; models made in the app have the second.
 */
export function feedbackKindsOf(model: Model): FeedbackKind[] {
  const perFeature = model.features.flatMap((feature) => ('feedback' in feature && feature.feedback ? [feature.feedback] : []))
  const used = new Set<FeedbackKind>(model.feedback)
  if (perFeature.some((feedback) => feedback.sound === 'voice')) used.add('voiceCallouts')
  if (perFeature.some((feedback) => feedback.sound === 'beep')) used.add('beeps')
  if (perFeature.some((feedback) => feedback.vibration)) used.add('vibration')
  if (model.lightColour !== null || perFeature.some(setsAColour)) used.add('ledColour')
  return KINDS.filter((kind) => used.has(kind))
}
