// What a radio is, described as data.
// The MT12 itself is written out in catalog.ts. Nothing here depends on a screen.

/** A physical control on the radio, by the name printed next to it. */
export type ControlId =
  | 'wheel'
  | 'trigger'
  | 'SA'
  | 'SB'
  | 'SC'
  | 'SD'
  | 'P1'
  | 'P2'
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | 'baseSwitchLeft'
  | 'baseSwitchRight'
  | 'joystickLeftRight'
  | 'joystickUpDown'

/**
 * What kind of control it is. The kind decides what a control can be used for.
 *
 * - 'wheel' and 'trigger' are always steering and throttle. They are never offered for anything else.
 * - 'switch3' has three positions (up, middle, down) and stays where you put it.
 * - 'switch2' has two positions and stays where you put it.
 * - 'pushButton' springs back when you let go.
 * - 'buttonPair' is two small buttons that spring back and work together, such as T1.
 * - 'dial' turns.
 */
export type ControlKind = 'wheel' | 'trigger' | 'switch3' | 'switch2' | 'pushButton' | 'buttonPair' | 'dial'

export interface ControlDefinition {
  id: ControlId
  kind: ControlKind
  /** Set on a control that only exists when this is fitted on the base of the radio. */
  fitting?: BaseFitting
}

/** A kind of receiver the radio can talk to. */
export interface ReceiverTypeDefinition {
  id: string
  /** Who makes it. Receivers are listed under their brand. */
  brand: string
  /** Set when this receiver expects gyro gain on one particular port. */
  gyroGainPort?: number
  /**
   * The two numbers the radio's module uses to pick this receiver type. Later cycles write them
   * to the radio's files. They are never shown on screen.
   */
  moduleNumbers: readonly [number, number]
}

/** The part of the radio that talks to receivers. It decides which receiver types are on offer. */
export interface RadioModuleDefinition {
  id: string
  receiverTypes: readonly ReceiverTypeDefinition[]
}

/** What is fitted on the base of the radio. */
export type BaseFitting = 'blankCover' | 'twoSwitches' | 'joystick'

/** A setting given as a percentage, with the lowest and highest the app offers and where it starts. */
export interface PercentRange {
  min: number
  max: number
  standard: number
}

export interface RadioDefinition {
  id: string
  /** How many models the radio can hold. */
  maxModels: number
  /** The longest model name the radio accepts, in characters. */
  maxModelNameLength: number
  /** How many receiver ports the app offers, counted from 1. */
  receiverPorts: number
  /** The lowest port offered for an extra. The ports below it are left for steering and throttle. */
  firstExtraPort: number
  /** How far the wheels turn. */
  steeringTravel: PercentRange
  /** The top speed limit. */
  topSpeed: PercentRange
  controls: readonly ControlDefinition[]
  baseFittings: readonly BaseFitting[]
  modules: readonly RadioModuleDefinition[]
}
