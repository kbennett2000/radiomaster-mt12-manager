// The "Add a model" wizard: its steps, the answers gathered so far, and how they become a model.
// Nothing here touches the list of models. That only changes when the person finishes.

import { MT12, type ReceiverTypeId } from '../domain/catalog.ts'
import type { Direction, Model, ModelId } from '../domain/model.ts'
import { checkModelName, type ModelNameProblem } from '../domain/modelName.ts'

/** Every step of the wizard, in order. */
export const WIZARD_STEPS = ['name', 'receiver', 'steeringThrottle', 'extras', 'feedback', 'review', 'bind'] as const
export type WizardStepId = (typeof WIZARD_STEPS)[number]

/** The steps that are built so far, in order. Next and Back skip the others. */
export const BUILT_STEPS = ['name', 'receiver', 'steeringThrottle', 'review'] as const
export type BuiltStepId = (typeof BUILT_STEPS)[number]

export const isBuilt = (step: WizardStepId): step is BuiltStepId =>
  (BUILT_STEPS as readonly WizardStepId[]).includes(step)

export const stepAfter = (step: BuiltStepId): BuiltStepId | null => BUILT_STEPS[BUILT_STEPS.indexOf(step) + 1] ?? null
export const stepBefore = (step: BuiltStepId): BuiltStepId | null => BUILT_STEPS[BUILT_STEPS.indexOf(step) - 1] ?? null

/**
 * What kind of vehicle the model is for. It only helps the wizard suggest settings.
 * It is deliberately not part of the Model type, because the radio's files have nowhere to keep it.
 */
export type VehicleKind = 'carOrTruck' | 'crawler' | 'boat' | 'other'
export const VEHICLE_KINDS: readonly VehicleKind[] = ['carOrTruck', 'crawler', 'boat', 'other']

/** The throttle feels the wizard offers. A model read from a radio can also have a custom one. */
export type OfferedThrottleFeel = 'standard' | 'gentle'

/** The answers so far. */
export interface ModelDraft {
  /** The position the model will go into. */
  position: number
  name: string
  vehicleKind: VehicleKind | null
  receiverTypeId: ReceiverTypeId | null
  steeringDirection: Direction
  steeringTravel: number
  throttleDirection: Direction
  /** null until the person picks one. Until then the suggestion for the vehicle kind is used. */
  throttleFeel: OfferedThrottleFeel | null
  topSpeed: number
  steeringPort: number
  throttlePort: number
}

/** Parts of the wizard's screens that are not answers. */
export interface WizardView {
  /** What is typed in the receiver search. */
  search: string
  /** True while the "I can't find my receiver" panel is open. */
  cantFindOpen: boolean
  /** True while "More options" is open on the steering and throttle step. */
  moreOptionsOpen: boolean
}

export interface WizardState {
  /** The step the person is on. The page address decides this; it is kept here for when they try to leave. */
  step: BuiltStepId
  draft: ModelDraft
  view: WizardView
  /** The steps the person has tried to move on from. Missing answers are only pointed out on these. */
  tried: readonly BuiltStepId[]
}

export function newWizard(position: number): WizardState {
  return {
    step: 'name',
    draft: {
      position,
      name: '',
      vehicleKind: null,
      receiverTypeId: null,
      steeringDirection: 'normal',
      steeringTravel: MT12.steeringTravel.standard,
      throttleDirection: 'normal',
      throttleFeel: null,
      topSpeed: MT12.topSpeed.standard,
      steeringPort: 1,
      throttlePort: 2,
    },
    view: { search: '', cantFindOpen: false, moreOptionsOpen: false },
    tried: [],
  }
}

/** The throttle feel to show: the person's pick, or Gentle for a crawler and Standard for anything else. */
export const throttleFeelOf = (draft: ModelDraft): OfferedThrottleFeel =>
  draft.throttleFeel ?? (draft.vehicleKind === 'crawler' ? 'gentle' : 'standard')

/** What is still missing or wrong on each step. Every value is null when the step is fine. */
export interface DraftProblems {
  name: ModelNameProblem | null
  vehicleKind: 'missing' | null
  receiver: 'missing' | null
  ports: 'samePort' | null
}

export function problemsIn(draft: ModelDraft, models: readonly Model[]): DraftProblems {
  return {
    name: checkModelName(
      draft.name,
      models.map((model) => model.name),
    ),
    vehicleKind: draft.vehicleKind ? null : 'missing',
    receiver: draft.receiverTypeId ? null : 'missing',
    ports: draft.steeringPort === draft.throttlePort ? 'samePort' : null,
  }
}

/** True when a step has nothing missing or wrong. */
export function stepIsFine(step: BuiltStepId, problems: DraftProblems): boolean {
  if (step === 'name') return !problems.name && !problems.vehicleKind
  if (step === 'receiver') return !problems.receiver
  if (step === 'steeringThrottle') return !problems.ports
  return true
}

/** The first step before `step` that still needs an answer, or null when the way is clear. */
export function stepBlocking(step: BuiltStepId, problems: DraftProblems): BuiltStepId | null {
  const earlier = BUILT_STEPS.slice(0, BUILT_STEPS.indexOf(step))
  return earlier.find((candidate) => !stepIsFine(candidate, problems)) ?? null
}

/** Turns finished answers into a model. Returns null if an answer is still missing. */
export function modelFrom(draft: ModelDraft, id: ModelId, position: number): Model | null {
  if (!draft.receiverTypeId) return null
  return {
    id,
    position,
    name: draft.name.trim(),
    receiverTypeId: draft.receiverTypeId,
    features: [
      {
        kind: 'steering',
        control: 'wheel',
        port: draft.steeringPort,
        direction: draft.steeringDirection,
        travel: draft.steeringTravel,
      },
      {
        kind: 'throttle',
        control: 'trigger',
        port: draft.throttlePort,
        direction: draft.throttleDirection,
        feel: throttleFeelOf(draft),
        topSpeed: draft.topSpeed,
      },
    ],
    feedback: [],
  }
}
