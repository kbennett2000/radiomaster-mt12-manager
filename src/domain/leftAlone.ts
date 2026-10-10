// What a model can have that the app shows and never changes.
//
// Some settings can only be made on the radio itself. The app has no questions for them, so it
// has no safe way to write them again. It names each one, counts the control it uses as taken,
// and keeps it exactly as it is when the rest of the model is saved.
//
// This is the one place that decides what counts as "left alone". Later cycles, which read a
// model's real file, will add to it anything in that file the app does not recognise.

import type { FeedbackKind, Model } from './model.ts'
import type { ControlId } from './radio.ts'

/** One setting that was made on the radio and that the app leaves alone. */
export type LeftAlone =
  | { kind: 'throttlePresets'; control: ControlId }
  | { kind: 'oneButtonPreset'; name: string; control: ControlId }
  | { kind: 'customThrottleFeel' }
  /** Feedback set for the model as a whole, not for one extra. */
  | { kind: 'modelFeedback'; feedback: readonly FeedbackKind[] }

/** Everything on a model that the app leaves alone, in the order it is shown. */
export function leftAloneIn(model: Pick<Model, 'features' | 'feedback'>): LeftAlone[] {
  const found: LeftAlone[] = []
  for (const feature of model.features) {
    if (feature.kind === 'throttlePresets') found.push({ kind: 'throttlePresets', control: feature.control })
    if (feature.kind === 'oneButtonPreset') {
      found.push({ kind: 'oneButtonPreset', name: feature.name, control: feature.control })
    }
  }
  if (model.features.some((feature) => feature.kind === 'throttle' && feature.feel === 'custom')) {
    found.push({ kind: 'customThrottleFeel' })
  }
  if (model.feedback.length > 0) found.push({ kind: 'modelFeedback', feedback: model.feedback })
  return found
}

/** A control one of these settings uses. No extra can be given it, and nothing in the app frees it. */
export interface HeldControl {
  control: ControlId
  by: LeftAlone
}

/** The controls a model's left-alone settings use. They count as taken everywhere. */
export const controlsHeldIn = (model: Pick<Model, 'features' | 'feedback'>): HeldControl[] =>
  leftAloneIn(model).flatMap((setting) => ('control' in setting ? [{ control: setting.control, by: setting }] : []))
