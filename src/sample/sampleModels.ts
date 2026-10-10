// Sample data for the mockups. Later cycles read the same types from the radio's real files.

import type { ReceiverTypeId } from '../domain/catalog.ts'
import type { Feature, FeedbackKind, Model, ModelId } from '../domain/model.ts'
import type { ControlId } from '../domain/radio.ts'

// Every model has steering on the wheel (receiver port 1) and throttle on the trigger (receiver port 2).
// Direction, how far the wheels turn and the top speed limit are all at their standard values.
const steering: Feature = { kind: 'steering', control: 'wheel', port: 1, direction: 'normal', travel: 100 }
const throttle: Feature = {
  kind: 'throttle',
  control: 'trigger',
  port: 2,
  direction: 'normal',
  feel: 'standard',
  topSpeed: 100,
}
const throttleWithCustomFeel: Feature = { ...throttle, feel: 'custom' }

const twoSpeed = (control: ControlId, port: number): Feature => ({ kind: 'twoSpeedTransmission', control, port })
const frontDiffLock = (control: ControlId, port: number): Feature => ({ kind: 'frontDiffLock', control, port })
const rearDiffLock = (control: ControlId, port: number): Feature => ({ kind: 'rearDiffLock', control, port })
const lights = (control: ControlId, port: number): Feature => ({ kind: 'lights', control, port })
const gyroGain = (control: ControlId, port: number): Feature => ({ kind: 'gyroGain', control, port })
const dragBrake = (control: ControlId, port: number): Feature => ({ kind: 'dragBrake', control, port })
const customExtra = (name: string, control: ControlId, port: number): Feature => ({
  kind: 'customExtra',
  name,
  control,
  port,
})
const cruiseControl = (onOffControl: ControlId, speedControl: ControlId): Feature => ({
  kind: 'cruiseControl',
  onOffControl,
  speedControl,
})
const throttleArming = (control: ControlId): Feature => ({ kind: 'throttleArming', control })
const throttlePresets = (control: ControlId): Feature => ({ kind: 'throttlePresets', control })
const hornSound = (control: ControlId): Feature => ({ kind: 'hornSound', control })
const oneButtonPreset = (name: string, control: ControlId): Feature => ({ kind: 'oneButtonPreset', name, control })

/** The id of the sample model that starts in a position: m01 for position 1, and so on. */
const sampleId = (position: number): ModelId => `m${String(position).padStart(2, '0')}`

function model(
  position: number,
  name: string,
  receiverTypeId: ReceiverTypeId,
  extras: readonly Feature[] = [],
  feedback: readonly FeedbackKind[] = [],
  basics: readonly Feature[] = [steering, throttle],
): Model {
  return { id: sampleId(position), position, name, receiverTypeId, features: [...basics, ...extras], feedback }
}

// The radio's list as the sample starts: 20 models in positions 1 to 20, and positions 21 to 60 empty.
export const SAMPLE_MODELS: readonly Model[] = [
  model(1, 'Wraith', 'spektrum-dsmr'),
  model(2, 'TRX-4m 4s', 'frsky-d8', [lights('SA', 3), cruiseControl('SC', 'P1')], ['vibration']),
  model(
    3,
    'TRX-4',
    'spektrum-dsmr',
    [
      twoSpeed('SA', 3),
      frontDiffLock('T3', 4),
      rearDiffLock('T2', 5),
      lights('SB', 6),
      cruiseControl('SC', 'P1'),
      hornSound('SD'),
    ],
    ['voiceCallouts', 'vibration', 'ledColour'],
  ),
  model(
    4,
    'TRX4-Tow',
    'dumborc-x',
    [twoSpeed('SA', 3), lights('SB', 6), cruiseControl('SC', 'P1'), gyroGain('P2', 8)],
    ['beeps', 'vibration'],
  ),
  model(5, 'TRX-4m Tow', 'traxxas-tq', [twoSpeed('SA', 3)]),
  model(
    6,
    'TRX-4 2-2',
    'dumborc-x',
    [
      twoSpeed('SA', 3),
      frontDiffLock('T3', 4),
      rearDiffLock('T2', 5),
      customExtra('Trail Tracer mode', 'SB', 6),
      gyroGain('P2', 8),
      cruiseControl('SC', 'P1'),
      oneButtonPreset('Locked + low gear', 'SD'),
    ],
    ['beeps', 'vibration'],
  ),
  model(
    7,
    'Summit',
    'dumborc-x',
    [
      twoSpeed('SA', 3),
      frontDiffLock('T3', 4),
      rearDiffLock('T2', 5),
      dragBrake('P1', 6),
      gyroGain('P2', 8),
    ],
    ['beeps', 'vibration'],
  ),
  model(8, 'Slash 2WD', 'dumborc-x', [throttleArming('SC'), gyroGain('P2', 8), hornSound('SB')]),
  model(9, 'Tarantula', 'spektrum-dsmr', [], [], [steering, throttleWithCustomFeel]),
  model(10, 'Slash 4x4', 'dumborc-x', [gyroGain('P2', 8)]),
  model(11, 'Micro B', 'spektrum-slt'),
  model(12, 'SCX30', 'spektrum-slt', [], [], [steering, throttleWithCustomFeel]),
  model(13, 'EMB-MT', 'dumborc-x', [gyroGain('P1', 8)]),
  model(14, 'MojaveGrom', 'spektrum-slt'),
  model(15, 'MojaveGrm2', 'spektrum-slt'),
  model(16, 'SC10b', 'dumborc-x', [gyroGain('P2', 8)]),
  model(17, 'Maxx', 'dumborc-x', [gyroGain('P1', 8)]),
  model(18, 'Airboat', 'dumborc-x', [throttlePresets('SA'), customExtra('Port 8 dial', 'P1', 8)]),
  model(19, 'Hyper SSE', 'spektrum-dsmr', [hornSound('SD')]),
  model(20, 'Mini 8ight', 'dumborc-x', [gyroGain('P2', 8)]),
]

/** The model the sample radio is currently set to: Mini 8ight, in position 20. */
export const SAMPLE_CURRENT_MODEL_ID: ModelId = sampleId(20)

/** A plain steering-and-throttle model, used to fill the radio up for the "60 of 60" state. */
export function spareModel(position: number): Model {
  return model(position, `Spare ${position}`, 'spektrum-slt')
}
