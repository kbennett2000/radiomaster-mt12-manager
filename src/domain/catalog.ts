// The MT12, as data.
// Supporting another radio module (ELRS is next) means adding an entry here, not changing logic elsewhere.
// Display names for everything in this file live in the strings file, keyed by id.

import type {
  BaseFitting,
  ControlDefinition,
  ControlId,
  ControlKind,
  RadioDefinition,
  ReceiverTypeDefinition,
} from './radio.ts'

export const MT12 = {
  id: 'mt12',
  maxModels: 60,
  maxModelNameLength: 10,
  receiverPorts: 8,
  firstExtraPort: 3,
  steeringTravel: { min: 50, max: 120, standard: 100 },
  topSpeed: { min: 30, max: 100, standard: 100 },
  lightColours: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white'],
  // The order here is the order controls are listed in: by where they sit on the radio.
  controls: [
    { id: 'wheel', kind: 'wheel' },
    { id: 'trigger', kind: 'trigger' },
    { id: 'SA', kind: 'switch3' },
    { id: 'SB', kind: 'pushButton' },
    { id: 'SC', kind: 'pushButton' },
    { id: 'SD', kind: 'pushButton' },
    { id: 'P1', kind: 'dial' },
    { id: 'P2', kind: 'dial' },
    { id: 'T1', kind: 'buttonPair' },
    { id: 'T2', kind: 'buttonPair' },
    { id: 'T3', kind: 'buttonPair' },
    { id: 'T4', kind: 'buttonPair' },
    { id: 'T5', kind: 'buttonPair' },
    // The controls a base fitting adds. Their names and kinds are placeholders: I have not checked
    // them against a real radio with these fitted.
    { id: 'baseSwitchLeft', kind: 'switch2', fitting: 'twoSwitches' },
    { id: 'baseSwitchRight', kind: 'switch2', fitting: 'twoSwitches' },
    { id: 'joystickLeftRight', kind: 'dial', fitting: 'joystick' },
    { id: 'joystickUpDown', kind: 'dial', fitting: 'joystick' },
  ],
  baseFittings: ['blankCover', 'twoSwitches', 'joystick'],
  modules: [
    {
      // The internal 4-in-1 module. Each receiver type has a brand and the two numbers the module
      // uses to pick it. What the label on the receiver says is in the strings file.
      id: 'internal-4in1',
      receiverTypes: [
        { id: 'dumborc-x', brand: 'dumborc', gyroGainPort: 8, moduleNumbers: [74, 2] },
        { id: 'dumborc-p', brand: 'dumborc', gyroGainPort: 8, moduleNumbers: [74, 4] },
        { id: 'radiolink', brand: 'radiolink', gyroGainPort: 8, moduleNumbers: [74, 0] },
        { id: 'radiolink-r4eh', brand: 'radiolink', moduleNumbers: [74, 3] },
        { id: 'spektrum-dsmr', brand: 'spektrum', moduleNumbers: [6, 5] },
        { id: 'spektrum-dsm2', brand: 'spektrum', moduleNumbers: [6, 6] },
        { id: 'spektrum-slt', brand: 'spektrum', moduleNumbers: [11, 5] },
        { id: 'traxxas-tq', brand: 'traxxas', moduleNumbers: [43, 0] },
        { id: 'traxxas-tq-2217', brand: 'traxxas', moduleNumbers: [43, 1] },
        { id: 'frsky-d8', brand: 'frsky', moduleNumbers: [3, 0] },
        { id: 'frsky-d16', brand: 'frsky', moduleNumbers: [15, 0] },
        { id: 'flysky-afhds2a', brand: 'flysky', moduleNumbers: [28, 0] },
        { id: 'flysky-bs', brand: 'flysky', moduleNumbers: [28, 3] },
        { id: 'futaba-sfhss', brand: 'futaba', moduleNumbers: [21, 0] },
        { id: 'kyosho-fhss', brand: 'kyosho', moduleNumbers: [73, 0] },
        { id: 'kyosho-asf', brand: 'kyosho', moduleNumbers: [98, 0] },
        { id: 'losi', brand: 'losi', moduleNumbers: [89, 0] },
        { id: 'axial-scx24', brand: 'axial', moduleNumbers: [60, 2] },
        { id: 'wltoys', brand: 'wltoys', moduleNumbers: [62, 2] },
        { id: 'wltoys-v8', brand: 'wltoys', moduleNumbers: [76, 1] },
        { id: 'wpl', brand: 'wpl', moduleNumbers: [107, 0] },
        { id: 'kamtom', brand: 'kamtom', moduleNumbers: [104, 0] },
        { id: 'eazyrc', brand: 'eazyrc', moduleNumbers: [61, 0] },
        { id: 'jiabaile', brand: 'jiabaile', moduleNumbers: [102, 0] },
      ],
    },
  ],
} as const satisfies RadioDefinition

export type RadioModuleId = (typeof MT12.modules)[number]['id']
export type ReceiverTypeId = (typeof MT12.modules)[number]['receiverTypes'][number]['id']
export type BrandId = (typeof MT12.modules)[number]['receiverTypes'][number]['brand']

/** A colour the radio's lights can show. */
export type LightColour = (typeof MT12.lightColours)[number]
export const LIGHT_COLOURS: readonly LightColour[] = MT12.lightColours

/** Every receiver type the radio's module offers, in the order they are listed. */
export const RECEIVER_TYPES = MT12.modules.flatMap((module) => module.receiverTypes)

/** The port this receiver type expects gyro gain on, or null when any port will do. */
export function gyroGainPortFor(receiverTypeId: ReceiverTypeId | null): number | null {
  const receiver: ReceiverTypeDefinition | undefined = RECEIVER_TYPES.find((type) => type.id === receiverTypeId)
  return receiver?.gyroGainPort ?? null
}

/** The controls a radio really has: the ones every MT12 has, plus those its base fitting adds. */
export const controlsFor = (baseFitting: BaseFitting | null): readonly ControlDefinition[] =>
  MT12.controls.filter(
    (control: ControlDefinition) => control.fitting === undefined || control.fitting === baseFitting,
  )

/** What kind of control this is. */
export const controlKind = (id: ControlId): ControlKind =>
  MT12.controls.find((control) => control.id === id)?.kind ?? 'pushButton'

/** The receiver ports offered for extras: every port from the first one after steering and throttle. */
export const EXTRA_PORTS: readonly number[] = Array.from(
  { length: MT12.receiverPorts - MT12.firstExtraPort + 1 },
  (_, index) => MT12.firstExtraPort + index,
)

/** The receiver ports the app offers, counted from 1 as printed on the receiver's case. */
export const RECEIVER_PORTS: readonly number[] = Array.from({ length: MT12.receiverPorts }, (_, index) => index + 1)

export const DEFAULT_RADIO_MODULE_ID: RadioModuleId = 'internal-4in1'

/** What the app knows about the one radio that is plugged in. */
export interface RadioSetup {
  moduleId: RadioModuleId
  /** null until the owner has been asked. */
  baseFitting: BaseFitting | null
}
