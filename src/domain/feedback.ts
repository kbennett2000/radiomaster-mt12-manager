// The feedback a radio gives for a model: beeps, voice, vibration and the colour of its lights.

import type { ExtraFeedback, FeedbackKind, Model } from './model.ts'

/** The radio does nothing extra. Every extra starts here. */
export const NO_FEEDBACK: ExtraFeedback = { sound: 'off', vibration: false, lightColour: null }

/** True when the radio does anything at all for this feedback. */
export const givesFeedback = (feedback: ExtraFeedback): boolean =>
  feedback.sound !== 'off' || feedback.vibration || feedback.lightColour !== null

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
  if (model.lightColour !== null || perFeature.some((feedback) => feedback.lightColour !== null)) used.add('ledColour')
  return KINDS.filter((kind) => used.has(kind))
}
