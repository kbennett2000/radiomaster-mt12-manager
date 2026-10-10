// Plain words for controls, extras and how one works the other.
// Step 4 uses these for the extra being answered, and Review uses them for the finished model.

import { controlKind, controlsFor, RECEIVER_PORTS } from '../../domain/catalog.ts'
import { jobsOf, portOf, workingOf, type ControlRole, type ExtraAnswers, type Working } from '../../domain/extras.ts'
import type { Feature, SwitchPosition } from '../../domain/model.ts'
import type { BaseFitting, ControlId, ControlKind } from '../../domain/radio.ts'
import { strings } from '../../strings/en.ts'

const how = strings.addModel.how

/** What an extra is called while it is being answered. A "Something else" with no name yet says so. */
export const extraName = (extra: ExtraAnswers): string =>
  extra.kind === 'customExtra'
    ? extra.name.trim() || strings.addModel.extras.somethingElse
    : strings.features[extra.kind]

/** What a feature of a finished model is called. */
export function featureName(feature: Feature): string {
  if (feature.kind === 'customExtra') return feature.name
  if (feature.kind === 'oneButtonPreset') return strings.features.oneButtonPreset(feature.name)
  return strings.features[feature.kind]
}

/** The choices that change how a control works an extra. */
interface HowChoices {
  /** True for the throttle safety lock, which is worded as locked and unlocked, not on and off. */
  lock: boolean
  onPosition: SwitchPosition
  swapped: boolean
}

/**
 * One sentence saying how a control of this kind works something. Null when there is no sentence
 * for the pairing, which only happens for features the wizard does not offer.
 */
export function howItWorks(
  working: Working | 'steering' | 'throttle' | null,
  kind: ControlKind,
  choices: HowChoices,
): string | null {
  switch (working) {
    case null:
      return null
    case 'steering':
    case 'throttle':
    case 'dial':
    case 'cruiseSpeed':
      return how[working]
    case 'onOff': {
      const words = choices.lock ? how.lock : how.onOff
      if (kind === 'switch3') return words.switch3(choices.onPosition)
      return kind === 'pushButton' || kind === 'buttonPair' || kind === 'switch2' ? words[kind] : null
    }
    case 'twoSpeed':
      if (kind === 'switch3') return how.twoSpeed.switch3(choices.swapped)
      return kind === 'pushButton' || kind === 'buttonPair' || kind === 'switch2' ? how.twoSpeed[kind] : null
    case 'threePositions':
      return kind === 'switch3' || kind === 'buttonPair' ? how.threePositions[kind] : null
    case 'horn':
      return kind === 'pushButton' || kind === 'buttonPair' ? how.horn[kind] : null
    case 'cruiseOnOff':
      return kind === 'pushButton' || kind === 'switch2' ? how.cruiseOnOff[kind] : null
  }
}

/** How the control picked for an extra will work it. Null until a control is picked. */
export function howExtraWorks(extra: ExtraAnswers, role: ControlRole = 'main'): string | null {
  const control = role === 'speed' ? extra.speedControl : extra.control
  if (!control) return null
  return howItWorks(workingOf(extra, role), controlKind(control), {
    lock: extra.kind === 'throttleSafetyLock',
    onPosition: extra.onPosition,
    swapped: extra.swapped,
  })
}

const choicesOf = (feature: Feature): HowChoices => ({
  lock: feature.kind === 'throttleSafetyLock',
  onPosition: ('onPosition' in feature ? feature.onPosition : undefined) ?? 'up',
  swapped: feature.kind === 'twoSpeedTransmission' && feature.swapped === true,
})

/** One control and what it does on a model. `does` is null when the model does not use it. */
export interface ControlLine {
  control: ControlId
  does: string | null
}

/** Every control this radio has, in the order they sit on it, with what each does on the model. */
export function whatEachControlDoes(features: readonly Feature[], baseFitting: BaseFitting | null): ControlLine[] {
  const jobs = features.flatMap(jobsOf)
  return controlsFor(baseFitting).map(({ id, kind }) => {
    const mine = jobs.filter((job) => job.control === id)
    if (mine.length === 0) return { control: id, does: null }
    const lines = mine.map((job) => {
      // Cruise control uses two controls, so each line says which part this control does.
      let name = featureName(job.feature)
      if (job.working === 'cruiseOnOff') name = strings.addModel.review.jobPart(name, how.cruiseOnOffPart)
      if (job.working === 'cruiseSpeed') name = strings.addModel.review.jobPart(name, how.cruiseSpeedPart)
      return strings.addModel.review.job(name, howItWorks(job.working, kind, choicesOf(job.feature)))
    })
    return { control: id, does: lines.join(' ') }
  })
}

/** One receiver port and what plugs into it. `what` is null when nothing does. */
export interface PortLine {
  port: number
  what: string | null
}

/** Every receiver port, lowest first, with what plugs into it on the model. */
export const whatPlugsIn = (features: readonly Feature[]): PortLine[] =>
  RECEIVER_PORTS.map((port) => {
    const names = features.filter((feature) => portOf(feature) === port).map(featureName)
    return { port, what: names.length > 0 ? names.join(', ') : null }
  })

/** The words Voice would say as an extra switches, one for each state it can be in. */
export function voiceWords(extra: ExtraAnswers): readonly string[] {
  const voice = strings.addModel.feedback.voice
  switch (extra.kind) {
    case 'twoSpeedTransmission':
      // On the three-position switch the middle is neutral, so it has a word too.
      return extra.control && controlKind(extra.control) === 'switch3'
        ? voice.twoSpeedWithNeutral
        : voice.twoSpeedTransmission
    case 'frontDiffLock':
    case 'rearDiffLock':
    case 'lights':
    case 'cruiseControl':
    case 'throttleSafetyLock':
      return voice[extra.kind]
    case 'customExtra':
      return extra.works === 'threePositions'
        ? voice.threePositions(extraName(extra))
        : voice.onOff(extraName(extra))
    default:
      return []
  }
}
