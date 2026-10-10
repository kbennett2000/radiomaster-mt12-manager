// The extras a model can have, and the rules for the radio controls and receiver ports they use.
//
// One control does one job, and one receiver port takes one plug. The one exception is cruise
// control, which needs two controls: something to turn it on and off, and a dial for the speed.
//
// Nothing here depends on a screen. The wizard asks these functions what to offer and what is taken.

import { EXTRA_PORTS, controlKind, controlsFor, gyroGainPortFor, type ReceiverTypeId } from './catalog.ts'
import { colourStatesFor, givesFeedback, keepingColoursFor, NO_FEEDBACK } from './feedback.ts'
import type { HeldControl, LeftAlone } from './leftAlone.ts'
import type { CustomWorks, ExtraFeedback, ExtraState, Feature, SwitchPosition } from './model.ts'
import type { BaseFitting, ControlDefinition, ControlId, ControlKind } from './radio.ts'

/** The extras the wizard offers, in the order it lists them. "Something else" can be added more than once. */
export const EXTRA_KINDS = [
  'twoSpeedTransmission',
  'frontDiffLock',
  'rearDiffLock',
  'lights',
  'cruiseControl',
  'gyroGain',
  'dragBrake',
  'throttleSafetyLock',
  'hornSound',
  'customExtra',
] as const

export type ExtraKind = (typeof EXTRA_KINDS)[number]

/** The longest name a "Something else" extra can have, in characters. */
export const MAX_EXTRA_NAME_LENGTH = 20

/**
 * The ways a control can work an extra. Each one accepts only some kinds of control.
 * Cruise control has two: one for turning it on and off, one for setting the speed.
 */
export type Working = 'onOff' | 'twoSpeed' | 'threePositions' | 'dial' | 'horn' | 'cruiseOnOff' | 'cruiseSpeed'

/** The kinds of control each way of working accepts. */
export const ACCEPTED_KINDS: Record<Working, readonly ControlKind[]> = {
  onOff: ['switch3', 'pushButton', 'buttonPair', 'switch2'],
  twoSpeed: ['switch3', 'pushButton', 'buttonPair', 'switch2'],
  threePositions: ['switch3', 'buttonPair'],
  dial: ['dial'],
  horn: ['pushButton', 'buttonPair'],
  cruiseOnOff: ['pushButton', 'switch2'],
  cruiseSpeed: ['dial'],
}

interface ExtraDefinition {
  /** True when it is plugged into the receiver. False when it lives in the radio only. */
  usesPort: boolean
  /** How its control works it. A "Something else" works the way its owner says. */
  working: Working | 'chosen'
}

export const EXTRAS: Record<ExtraKind, ExtraDefinition> = {
  twoSpeedTransmission: { usesPort: true, working: 'twoSpeed' },
  frontDiffLock: { usesPort: true, working: 'onOff' },
  rearDiffLock: { usesPort: true, working: 'onOff' },
  lights: { usesPort: true, working: 'onOff' },
  // It acts on the throttle, so it has no port of its own.
  cruiseControl: { usesPort: false, working: 'cruiseOnOff' },
  gyroGain: { usesPort: true, working: 'dial' },
  dragBrake: { usesPort: true, working: 'dial' },
  throttleSafetyLock: { usesPort: false, working: 'onOff' },
  hornSound: { usesPort: false, working: 'horn' },
  customExtra: { usesPort: true, working: 'chosen' },
}

/** One extra as the person has answered it so far. Anything not yet answered is null or empty. */
export interface ExtraAnswers {
  /** Tells extras apart, since "Something else" can be added more than once. */
  id: string
  kind: ExtraKind
  /** The control that works it. For cruise control, the one that turns it on and off. */
  control: ControlId | null
  /** Cruise control only: the dial that sets the speed. */
  speedControl: ControlId | null
  /** The receiver port it is plugged into. Stays null for an extra that uses no port. */
  port: number | null
  /** On a three-position switch: the position that turns it on. */
  onPosition: SwitchPosition
  /** 2-speed transmission on a three-position switch: true swaps high and low gear. */
  swapped: boolean
  /** "Something else" only: what the owner calls it. */
  name: string
  /** "Something else" only: how it works. */
  works: CustomWorks | null
  /** How the radio tells the driver it has switched. Only used by an extra that switches. */
  feedback: ExtraFeedback
}

export function newExtra(id: string, kind: ExtraKind): ExtraAnswers {
  return {
    id,
    kind,
    control: null,
    speedControl: null,
    port: null,
    onPosition: 'up',
    swapped: false,
    name: '',
    works: null,
    feedback: NO_FEEDBACK,
  }
}

/** The part a control plays in an extra. Only cruise control has a 'speed' part. */
export type ControlRole = 'main' | 'speed'

/** The parts this extra needs a control for. */
export const rolesOf = (kind: ExtraKind): readonly ControlRole[] =>
  kind === 'cruiseControl' ? ['main', 'speed'] : ['main']

/**
 * How a control works this extra in the given part. Null for a "Something else" whose owner has
 * not yet said how it works.
 */
export function workingOf(extra: Pick<ExtraAnswers, 'kind' | 'works'>, role: ControlRole = 'main'): Working | null {
  if (role === 'speed') return extra.kind === 'cruiseControl' ? 'cruiseSpeed' : null
  const working = EXTRAS[extra.kind].working
  return working === 'chosen' ? extra.works : working
}

/**
 * True for an extra that switches between states, which the radio can announce. A dial is set to
 * any amount, so it does not, and neither does the horn.
 */
export function switches(extra: Pick<ExtraAnswers, 'kind' | 'works'>): boolean {
  const working = workingOf(extra)
  return working === 'onOff' || working === 'twoSpeed' || working === 'threePositions' || working === 'cruiseOnOff'
}

/**
 * The states of this extra the radio's lights can show a colour for. Most have one, on. A 2-speed
 * transmission has low and high gear, and neutral too when a three-position switch works it.
 */
export const colourStatesOf = (extra: Pick<ExtraAnswers, 'kind' | 'works' | 'control'>): readonly ExtraState[] =>
  colourStatesFor(workingOf(extra), extra.control ? controlKind(extra.control) : null)

const controlFor = (extra: ExtraAnswers, role: ControlRole): ControlId | null =>
  role === 'speed' ? extra.speedControl : extra.control

/** A control an extra could use, and what already uses it, if anything. */
export interface ControlChoice {
  control: ControlDefinition
  /** The other extra that uses it. */
  takenBy: ExtraAnswers | null
  /** A setting made on the radio that uses it. The app leaves those alone, so it cannot be freed here. */
  heldBy: LeftAlone | null
}

/**
 * The controls on this radio that can work the extra in the given part. Only kinds that make
 * sense are offered. A control something else already uses is still listed, marked as taken:
 * by another extra, or by a setting made on the radio (`held`).
 */
export function controlChoices(
  extra: ExtraAnswers,
  role: ControlRole,
  extras: readonly ExtraAnswers[],
  baseFitting: BaseFitting | null,
  held: readonly HeldControl[] = [],
): ControlChoice[] {
  const working = workingOf(extra, role)
  if (!working) return []
  return controlsFor(baseFitting)
    .filter((control) => ACCEPTED_KINDS[working].includes(control.kind))
    .map((control) => ({
      control,
      takenBy:
        extras.find(
          (other) =>
            other.id !== extra.id && (other.control === control.id || other.speedControl === control.id),
        ) ?? null,
      heldBy: held.find((holding) => holding.control === control.id)?.by ?? null,
    }))
}

/** The receiver ports steering and throttle are plugged into. */
export interface BasicPorts {
  steeringPort: number
  throttlePort: number
}

/** What is plugged into a receiver port. */
export type PortUser = { what: 'steering' } | { what: 'throttle' } | { what: 'extra'; extra: ExtraAnswers }

/** What already uses a port, leaving out the extra with the given id. Null when the port is free. */
export function portUser(
  port: number,
  extras: readonly ExtraAnswers[],
  basics: BasicPorts,
  exceptId?: string,
): PortUser | null {
  if (basics.steeringPort === port) return { what: 'steering' }
  if (basics.throttlePort === port) return { what: 'throttle' }
  const extra = extras.find((other) => other.id !== exceptId && other.port === port)
  return extra ? { what: 'extra', extra } : null
}

/** A port an extra could be plugged into, and what already uses it, if anything. */
export interface PortChoice {
  port: number
  takenBy: PortUser | null
}

/** The ports offered for an extra, each marked with what already uses it. Two things cannot share a port. */
export const portChoices = (
  extra: ExtraAnswers,
  extras: readonly ExtraAnswers[],
  basics: BasicPorts,
): PortChoice[] => EXTRA_PORTS.map((port) => ({ port, takenBy: portUser(port, extras, basics, extra.id) }))

/**
 * The port to start a new extra on: the lowest free one. Gyro gain starts on the port its
 * receiver expects, when the receiver has one and it is free. Null when every port is taken.
 */
export function suggestedPort(
  kind: ExtraKind,
  extras: readonly ExtraAnswers[],
  basics: BasicPorts,
  receiverTypeId: ReceiverTypeId | null,
): number | null {
  if (!EXTRAS[kind].usesPort) return null
  const free = EXTRA_PORTS.filter((port) => portUser(port, extras, basics) === null)
  const hinted = kind === 'gyroGain' ? gyroGainPortFor(receiverTypeId) : null
  if (hinted !== null && free.includes(hinted)) return hinted
  return free[0] ?? null
}

/** Something still missing from an extra's answers. */
export type ExtraProblem =
  | 'nameMissing'
  | 'nameTooLong'
  | 'worksMissing'
  | 'controlMissing'
  | 'speedControlMissing'
  | 'portMissing'

/** What is still missing from one extra, in the order its questions are asked. Empty when it is complete. */
export function problemsInExtra(extra: ExtraAnswers): ExtraProblem[] {
  const problems: ExtraProblem[] = []
  if (extra.kind === 'customExtra') {
    const length = extra.name.trim().length
    if (length === 0) problems.push('nameMissing')
    else if (length > MAX_EXTRA_NAME_LENGTH) problems.push('nameTooLong')
    if (!extra.works) problems.push('worksMissing')
  }
  // The control is only asked for once it is known how the extra works.
  for (const role of rolesOf(extra.kind)) {
    if (workingOf(extra, role) && !controlFor(extra, role)) {
      problems.push(role === 'speed' ? 'speedControlMissing' : 'controlMissing')
    }
  }
  if (EXTRAS[extra.kind].usesPort && extra.port === null) problems.push('portMissing')
  return problems
}

/**
 * Tidies answers after one of them changes, so they never contradict each other. A control of a
 * kind the extra no longer accepts is dropped, which changing how a "Something else" works can
 * do. So is a light colour for a state the extra no longer has, such as neutral once its control
 * is not the three-position switch.
 */
export function tidied(extra: ExtraAnswers): ExtraAnswers {
  const working = workingOf(extra)
  const stillFits = extra.control !== null && working !== null && ACCEPTED_KINDS[working].includes(controlKind(extra.control))
  const fitted = stillFits || extra.control === null ? extra : { ...extra, control: null }
  return { ...fitted, feedback: keepingColoursFor(fitted.feedback, colourStatesOf(fitted)) }
}

/** Turns complete answers into a feature of the model. Null while anything is missing. */
export function featureFrom(extra: ExtraAnswers): Feature | null {
  const { control, port } = extra
  if (problemsInExtra(extra).length > 0 || control === null) return null
  // Which position is "on" only means something on a three-position switch.
  const onPosition = controlKind(control) === 'switch3' ? { onPosition: extra.onPosition } : {}
  // Feedback is recorded only when the radio does something, and only for an extra that switches.
  const feedback = switches(extra) && givesFeedback(extra.feedback) ? { feedback: extra.feedback } : {}

  switch (extra.kind) {
    case 'cruiseControl':
      return extra.speedControl === null
        ? null
        : { kind: 'cruiseControl', onOffControl: control, speedControl: extra.speedControl, ...feedback }
    case 'throttleSafetyLock':
      return { kind: 'throttleSafetyLock', control, ...onPosition, ...feedback }
    case 'hornSound':
      return { kind: 'hornSound', control }
  }
  if (port === null) return null

  switch (extra.kind) {
    case 'twoSpeedTransmission':
      return controlKind(control) === 'switch3' && extra.swapped
        ? { kind: 'twoSpeedTransmission', control, port, swapped: true, ...feedback }
        : { kind: 'twoSpeedTransmission', control, port, ...feedback }
    case 'frontDiffLock':
    case 'rearDiffLock':
    case 'lights':
      return { kind: extra.kind, control, port, ...onPosition, ...feedback }
    case 'gyroGain':
    case 'dragBrake':
      return { kind: extra.kind, control, port }
    case 'customExtra':
      if (!extra.works) return null
      return extra.works === 'onOff'
        ? { kind: 'customExtra', name: extra.name.trim(), works: extra.works, control, port, ...onPosition, ...feedback }
        : { kind: 'customExtra', name: extra.name.trim(), works: extra.works, control, port, ...feedback }
  }
}

/**
 * The other way round from `featureFrom`: the answers that would make a feature of a model. Null
 * for steering, throttle and anything the wizard does not offer, which are not extras.
 */
export function answersFrom(feature: Feature, id: string): ExtraAnswers | null {
  if (feature.kind === 'steering' || feature.kind === 'throttle') return null
  if (feature.kind === 'throttlePresets' || feature.kind === 'oneButtonPreset') return null
  const answers = newExtra(id, feature.kind)
  const feedback = ('feedback' in feature ? feature.feedback : undefined) ?? NO_FEEDBACK
  const onPosition = ('onPosition' in feature ? feature.onPosition : undefined) ?? answers.onPosition

  switch (feature.kind) {
    case 'cruiseControl':
      return tidied({ ...answers, control: feature.onOffControl, speedControl: feature.speedControl, feedback })
    case 'throttleSafetyLock':
      return tidied({ ...answers, control: feature.control, onPosition, feedback })
    case 'hornSound':
      return tidied({ ...answers, control: feature.control })
    case 'twoSpeedTransmission':
      return tidied({ ...answers, control: feature.control, port: feature.port, swapped: feature.swapped === true, feedback })
    case 'gyroGain':
    case 'dragBrake':
      return tidied({ ...answers, control: feature.control, port: feature.port })
    case 'customExtra':
      return tidied({
        ...answers,
        name: feature.name,
        works: feature.works,
        control: feature.control,
        port: feature.port,
        onPosition,
        feedback,
      })
    default:
      return tidied({ ...answers, control: feature.control, port: feature.port, onPosition, feedback })
  }
}

/** One control at work on a model: what it works, and in which way. */
export interface ControlJob {
  control: ControlId
  feature: Feature
  /** Null for a feature the wizard does not offer, which has no plain sentence yet. */
  working: Working | 'steering' | 'throttle' | null
}

/** Every control a feature uses. Cruise control is the only one that uses two. */
export function jobsOf(feature: Feature): ControlJob[] {
  switch (feature.kind) {
    case 'steering':
    case 'throttle':
      return [{ control: feature.control, feature, working: feature.kind }]
    case 'cruiseControl':
      return [
        { control: feature.onOffControl, feature, working: 'cruiseOnOff' },
        { control: feature.speedControl, feature, working: 'cruiseSpeed' },
      ]
    case 'customExtra':
      return [{ control: feature.control, feature, working: feature.works }]
    case 'throttlePresets':
    case 'oneButtonPreset':
      return [{ control: feature.control, feature, working: null }]
    default: {
      const working = EXTRAS[feature.kind].working
      return [{ control: feature.control, feature, working: working === 'chosen' ? null : working }]
    }
  }
}

/** The receiver port a feature is plugged into, or null when it lives in the radio only. */
export const portOf = (feature: Feature): number | null => ('port' in feature ? feature.port : null)
