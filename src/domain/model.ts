// The contract for a model and its features.
// Later cycles fill these same types from the radio's real files, so nothing here may depend on a screen.

import type { LightColour, ReceiverTypeId } from './catalog.ts'
import type { ControlId } from './radio.ts'

export type ModelId = string

/** A numbered port on the receiver, counted from 1 as printed on the receiver's case. */
export type ReceiverPort = number

/** A feature that drives something plugged into the receiver. */
interface WorkedThroughPort {
  /** The radio control that works it. */
  control: ControlId
  /** The receiver port it is plugged into. */
  port: ReceiverPort
}

/** A feature that lives in the radio only and uses no receiver port of its own. */
interface WorkedOnRadio {
  /** The radio control that works it. */
  control: ControlId
}

/** The sound the radio makes when an extra switches. */
export type FeedbackSound = 'off' | 'beep' | 'voice'

/**
 * A state an extra can be in, which the radio's lights can show with a colour. Most extras have
 * one, 'on'. A 2-speed transmission is in low or high gear, with neutral between them on a
 * three-position switch. A "Something else" with three positions is up, in the middle or down.
 * See feedback.ts for which states an extra has.
 */
export type ExtraState = 'on' | 'low' | 'high' | 'neutral' | 'up' | 'middle' | 'down'

/** How the radio tells the driver that one extra has switched, so they need not look down. */
export interface ExtraFeedback {
  sound: FeedbackSound
  vibration: boolean
  /** The colour the radio's lights show while the extra is on. Null leaves the lights alone. */
  lightColour: LightColour | null
  /**
   * For an extra that is not simply on or off: the colour for each of its states. A state left
   * out leaves the lights alone. Feedback recorded before states had colours has no such list,
   * and reads as no colour for any of them.
   */
  stateColours?: Partial<Record<Exclude<ExtraState, 'on'>, LightColour>>
}

/** A feature that switches between states, which the radio can announce. A dial does not. */
interface Switches {
  /** Left out when the radio does nothing extra as this feature switches. */
  feedback?: ExtraFeedback
}

/** A position of a switch. A two-position switch has no middle. */
export type SwitchPosition = 'up' | 'middle' | 'down'

/**
 * A feature that is either on or off. How its control works it follows from the kind of control:
 * a push button turns it on and then off, a button pair has one button for each, and a switch is
 * on in one position.
 */
interface OnAndOff {
  /** On a three-position switch: the position that turns it on. Other kinds of control ignore it. */
  onPosition?: SwitchPosition
}

/** Which way a control drives what it is plugged into. 'reversed' swaps the two ways round. */
export type Direction = 'normal' | 'reversed'

export interface SteeringFeature extends WorkedThroughPort {
  kind: 'steering'
  direction: Direction
  /** How far the wheels turn, as a percentage. See MT12.steeringTravel for the range. */
  travel: number
}

/**
 * How the trigger responds. 'gentle' makes the first part of the trigger less sensitive.
 * 'custom' is a shape the owner made themselves, which the app can show but not yet edit.
 */
export type ThrottleFeel = 'standard' | 'gentle' | 'custom'

export interface ThrottleFeature extends WorkedThroughPort {
  kind: 'throttle'
  direction: Direction
  feel: ThrottleFeel
  /** The most throttle the trigger can ask for, as a percentage. See MT12.topSpeed for the range. */
  topSpeed: number
}

export interface TwoSpeedTransmissionFeature extends WorkedThroughPort, Switches {
  kind: 'twoSpeedTransmission'
  /** On a three-position switch, up is high gear and down is low gear. True swaps the two. */
  swapped?: boolean
}

export interface FrontDiffLockFeature extends WorkedThroughPort, OnAndOff, Switches {
  kind: 'frontDiffLock'
}

export interface RearDiffLockFeature extends WorkedThroughPort, OnAndOff, Switches {
  kind: 'rearDiffLock'
}

export interface LightsFeature extends WorkedThroughPort, OnAndOff, Switches {
  kind: 'lights'
}

export interface GyroGainFeature extends WorkedThroughPort {
  kind: 'gyroGain'
}

export interface DragBrakeFeature extends WorkedThroughPort {
  kind: 'dragBrake'
}

/**
 * The ways an extra the owner named can work: on and off, three positions (good for a winch),
 * or set to any amount with a dial.
 */
export type CustomWorks = 'onOff' | 'threePositions' | 'dial'

/** Anything the vehicle has that the app has no name for. The owner names it and says how it works. */
export interface CustomExtraFeature extends WorkedThroughPort, OnAndOff, Switches {
  kind: 'customExtra'
  name: string
  works: CustomWorks
}

/** Holds a speed without the trigger. It acts on the throttle, so it has no port of its own. */
export interface CruiseControlFeature extends Switches {
  kind: 'cruiseControl'
  /** The control that turns it on and off. */
  onOffControl: ControlId
  /** The control that sets the speed. */
  speedControl: ControlId
}

/** The trigger does nothing until this control unlocks it. "On" here means unlocked. */
export interface ThrottleSafetyLockFeature extends WorkedOnRadio, OnAndOff, Switches {
  kind: 'throttleSafetyLock'
}

/** A control that jumps the throttle to set positions. The wizard does not offer this yet. */
export interface ThrottlePresetsFeature extends WorkedOnRadio {
  kind: 'throttlePresets'
}

/** The radio plays a horn sound. */
export interface HornSoundFeature extends WorkedOnRadio {
  kind: 'hornSound'
}

/** One control that sets several other features at once. The owner names it. The wizard does not offer this yet. */
export interface OneButtonPresetFeature extends WorkedOnRadio {
  kind: 'oneButtonPreset'
  name: string
}

export type Feature =
  | SteeringFeature
  | ThrottleFeature
  | TwoSpeedTransmissionFeature
  | FrontDiffLockFeature
  | RearDiffLockFeature
  | LightsFeature
  | CruiseControlFeature
  | GyroGainFeature
  | DragBrakeFeature
  | ThrottleSafetyLockFeature
  | ThrottlePresetsFeature
  | HornSoundFeature
  | OneButtonPresetFeature
  | CustomExtraFeature

export type FeatureKind = Feature['kind']

/** A way the radio itself tells the driver something. The list shows these as one quiet line. */
export type FeedbackKind = 'voiceCallouts' | 'beeps' | 'vibration' | 'ledColour'

/** One vehicle's setup on the radio. */
export interface Model {
  id: ModelId
  /**
   * The model's place in the radio's own list, counted from 1 up to MT12.maxModels.
   * No two models share a place, and a place no model has is empty. See positions.ts for the rules.
   */
  position: number
  /** At most MT12.maxModelNameLength characters. */
  name: string
  receiverTypeId: ReceiverTypeId
  /** What the vehicle has, in the order the owner sees it. */
  features: readonly Feature[]
  /**
   * Feedback the radio gives that is not tied to one feature. Feedback for a feature is kept on
   * the feature itself. A model read from a radio may have only this.
   */
  feedback: readonly FeedbackKind[]
  /** The colour the radio's lights show while it is set to this model. Null leaves them alone. */
  lightColour: LightColour | null
}
