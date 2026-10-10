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

export interface SteeringFeature extends WorkedThroughPort {
  kind: 'steering'
}

export type ThrottleFeel = 'standard' | 'custom'

export interface ThrottleFeature extends WorkedThroughPort {
  kind: 'throttle'
  /** 'custom' when the owner has reshaped how the trigger responds. */
  feel: ThrottleFeel
}

export interface TwoSpeedTransmissionFeature extends WorkedThroughPort {
  kind: 'twoSpeedTransmission'
}

export interface FrontDiffLockFeature extends WorkedThroughPort {
  kind: 'frontDiffLock'
}

export interface RearDiffLockFeature extends WorkedThroughPort {
  kind: 'rearDiffLock'
}

export interface LightsFeature extends WorkedThroughPort {
  kind: 'lights'
}

export interface GyroGainFeature extends WorkedThroughPort {
  kind: 'gyroGain'
}

export interface DragBrakeFeature extends WorkedThroughPort {
  kind: 'dragBrake'
}

/** Anything the vehicle has that the app has no name for. The owner names it. */
export interface CustomExtraFeature extends WorkedThroughPort {
  kind: 'customExtra'
  name: string
}

/** Holds a speed without the trigger. It acts on the throttle, so it has no port of its own. */
export interface CruiseControlFeature {
  kind: 'cruiseControl'
  /** The control that turns it on and off. */
  onOffControl: ControlId
  /** The control that sets the speed. */
  speedControl: ControlId
}

/** The throttle does nothing until this control is switched on. */
export interface ThrottleArmingFeature extends WorkedOnRadio {
  kind: 'throttleArming'
}

/** A control that jumps the throttle to set positions. */
export interface ThrottlePresetsFeature extends WorkedOnRadio {
  kind: 'throttlePresets'
}

/** The radio plays a horn sound. */
export interface HornSoundFeature extends WorkedOnRadio {
  kind: 'hornSound'
}

/** One control that sets several other features at once. The owner names it. */
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
  | ThrottleArmingFeature
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
