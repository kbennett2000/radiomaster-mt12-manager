import type { Feature, Model } from '../../domain/model.ts'
import { listOf, strings } from '../../strings/en.ts'

export interface ModelTags {
  /** One short tag per extra the vehicle has. Empty when it has steering and throttle only. */
  extras: string[]
  /** How the radio itself responds, as one quiet line, or null when it does nothing extra. */
  feedback: string | null
}

/** The tag for one feature. Steering and plain throttle get none, because every model has them. */
function tagFor(feature: Feature): string | null {
  switch (feature.kind) {
    case 'steering':
      return null
    case 'throttle':
      if (feature.feel === 'gentle') return strings.tags.gentleThrottle
      return feature.feel === 'custom' ? strings.tags.customThrottleFeel : null
    case 'oneButtonPreset':
      return strings.features.oneButtonPreset(feature.name)
    case 'customExtra':
      return strings.features.customExtra(feature.name)
    default:
      return strings.features[feature.kind]
  }
}

/** What to show on a model's row: its extras as tags, and the radio's feedback more quietly. */
export function tagsFor(model: Model): ModelTags {
  const feedback = model.feedback.map((kind) => strings.feedback[kind])
  return {
    extras: model.features.flatMap((feature) => tagFor(feature) ?? []),
    feedback: feedback.length > 0 ? strings.tags.feedback(listOf(feedback)) : null,
  }
}
