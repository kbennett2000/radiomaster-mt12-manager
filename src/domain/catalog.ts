// The MT12, as data.
// Supporting another radio module (ELRS is next) means adding an entry here, not changing logic elsewhere.
// Display names for everything in this file live in the strings file, keyed by id.

import type { BaseFitting, RadioDefinition } from './radio.ts'

export const MT12 = {
  id: 'mt12',
  maxModels: 60,
  maxModelNameLength: 10,
  receiverPorts: 8,
  steeringTravel: { min: 50, max: 120, standard: 100 },
  topSpeed: { min: 30, max: 100, standard: 100 },
  controls: [
    { id: 'wheel', type: 'wheel' },
    { id: 'trigger', type: 'trigger' },
    { id: 'SA', type: 'switch' },
    { id: 'SB', type: 'switch' },
    { id: 'SC', type: 'switch' },
    { id: 'SD', type: 'switch' },
    { id: 'P1', type: 'dial' },
    { id: 'P2', type: 'dial' },
    { id: 'T1', type: 'buttons' },
    { id: 'T2', type: 'buttons' },
    { id: 'T3', type: 'buttons' },
    { id: 'T4', type: 'buttons' },
    { id: 'T5', type: 'buttons' },
  ],
  baseFittings: ['blankCover', 'twoSwitches', 'joystick'],
  modules: [
    {
      // The internal 4-in-1 module. Each receiver type has a brand and the two numbers the module
      // uses to pick it. What the label on the receiver says is in the strings file.
      id: 'internal-4in1',
      receiverTypes: [
        { id: 'dumborc-x', brand: 'dumborc', moduleNumbers: [74, 2] },
        { id: 'dumborc-p', brand: 'dumborc', moduleNumbers: [74, 4] },
        { id: 'radiolink', brand: 'radiolink', moduleNumbers: [74, 0] },
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

/** Every receiver type the radio's module offers, in the order they are listed. */
export const RECEIVER_TYPES = MT12.modules.flatMap((module) => module.receiverTypes)

/** The receiver ports the app offers, counted from 1 as printed on the receiver's case. */
export const RECEIVER_PORTS: readonly number[] = Array.from({ length: MT12.receiverPorts }, (_, index) => index + 1)

export const DEFAULT_RADIO_MODULE_ID: RadioModuleId = 'internal-4in1'

/** What the app knows about the one radio that is plugged in. */
export interface RadioSetup {
  moduleId: RadioModuleId
  /** null until the owner has been asked. */
  baseFitting: BaseFitting | null
}
