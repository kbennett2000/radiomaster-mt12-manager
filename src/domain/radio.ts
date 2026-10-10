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

/** 'buttons' is a pair of small buttons that work together, such as T1. */
export type ControlType = 'wheel' | 'trigger' | 'switch' | 'dial' | 'buttons'

export interface ControlDefinition {
  id: ControlId
  type: ControlType
}

/** A kind of receiver the radio can talk to. */
export interface ReceiverTypeDefinition {
  id: string
}

/** The part of the radio that talks to receivers. It decides which receiver types are on offer. */
export interface RadioModuleDefinition {
  id: string
  receiverTypes: readonly ReceiverTypeDefinition[]
}

/** What is fitted on the base of the radio. */
export type BaseFitting = 'blankCover' | 'twoSwitches' | 'joystick'

export interface RadioDefinition {
  id: string
  /** How many models the radio can hold. */
  maxModels: number
  /** The longest model name the radio accepts, in characters. */
  maxModelNameLength: number
  controls: readonly ControlDefinition[]
  baseFittings: readonly BaseFitting[]
  modules: readonly RadioModuleDefinition[]
}
