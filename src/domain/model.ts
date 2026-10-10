// The contract for a model and its features.
// Later cycles fill these same types from the radio's real files, so nothing here may depend on a screen.

import type { ReceiverTypeId } from './catalog.ts'
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

export interface TwoSpeedTransmissionFeature extends WorkedThroughPort {
  kind: 'twoSpeedTransmission'
  /** On a three-position switch, up is high gear and down is low gear. True swaps the two. */
  swapped?: boolean
}

export interface FrontDiffLockFeature extends WorkedThroughPort, OnAndOff {
  kind: 'frontDiffLock'
}

export interface RearDiffLockFeature extends WorkedThroughPort, OnAndOff {
  kind: 'rearDiffLock'
}

export interface LightsFeature extends WorkedThroughPort, OnAndOff {
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
export interface CustomExtraFeature extends WorkedThroughPort, OnAndOff {
  kind: 'customExtra'
  name: string
  works: CustomWorks
}

/** Holds a speed without the trigger. It acts on the throttle, so it has no port of its own. */
export interface CruiseControlFeature {
  kind: 'cruiseControl'
  /** The control that turns it on and off. */
  onOffControl: ControlId
  /** The control that sets the speed. */
  speedControl: ControlId
}

/** The trigger does nothing until this control unlocks it. "On" here means unlocked. */
export interface ThrottleSafetyLockFeature extends WorkedOnRadio, OnAndOff {
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

/** A way the radio itself tells the driver something. */
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
  feedback: readonly FeedbackKind[]
}
