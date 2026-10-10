import type { Feature, Model } from '../../domain/model.ts'
import { listOf, strings } from '../../strings/en.ts'

export interface ModelSummary {
  /** What the vehicle has, as one plain sentence. */
  features: string
  /** How the radio itself responds, or null when it does nothing extra. */
  feedback: string | null
}

const capitalise = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1)

/** The words for one feature beyond steering and throttle. */
function extraLabel(feature: Feature): string | null {
  switch (feature.kind) {
    case 'steering':
      return null
    case 'throttle':
      return feature.feel === 'custom' ? strings.summary.customThrottleFeel : null
    case 'oneButtonPreset':
      return strings.features.oneButtonPreset(feature.name)
    case 'customExtra':
      return strings.features.customExtra(feature.name)
    default:
      return strings.features[feature.kind]
  }
}

/** Describes a model in plain words for its card: what the vehicle has, and how the radio responds. */
export function summarizeModel(model: Model): ModelSummary {
  const basics = model.features.flatMap((feature) =>
    feature.kind === 'steering' || feature.kind === 'throttle' ? [strings.summary[feature.kind]] : [],
  )
  const extras = model.features.flatMap((feature) => extraLabel(feature) ?? [])
  const feedback = model.feedback.map((kind) => strings.feedback[kind])

  let features: string = strings.summary.nothing
  if (basics.length > 0 && extras.length > 0) {
    features = strings.summary.basicsPlus(capitalise(listOf(basics)), listOf(extras))
  } else if (basics.length > 0) {
    features = strings.summary.basicsOnly(capitalise(listOf(basics)))
  } else if (extras.length > 0) {
    features = strings.summary.extrasOnly(capitalise(listOf(extras)))
  }

  return {
    features,
    feedback: feedback.length > 0 ? strings.summary.feedback(listOf(feedback)) : null,
  }
}
