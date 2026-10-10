// The MT12, as data.
// Supporting another radio module (ELRS is next) means adding an entry here, not changing logic elsewhere.
// Display names for everything in this file live in the strings file, keyed by id.

import type { BaseFitting, RadioDefinition } from './radio.ts'

export const MT12 = {
  id: 'mt12',
  maxModels: 60,
  maxModelNameLength: 10,
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
      // The internal 4-in-1 module. Only the receiver types the sample data uses are listed so far.
      id: 'internal-4in1',
      receiverTypes: [
        { id: 'spektrum-dsmr' },
        { id: 'spektrum-slt' },
        { id: 'frsky-d8' },
        { id: 'dumborc-x' },
        { id: 'traxxas-tq' },
      ],
    },
  ],
} as const satisfies RadioDefinition

export type RadioModuleId = (typeof MT12.modules)[number]['id']
export type ReceiverTypeId = (typeof MT12.modules)[number]['receiverTypes'][number]['id']

export const DEFAULT_RADIO_MODULE_ID: RadioModuleId = 'internal-4in1'

/** What the app knows about the one radio that is plugged in. */
export interface RadioSetup {
  moduleId: RadioModuleId
  /** null until the owner has been asked. */
  baseFitting: BaseFitting | null
}
