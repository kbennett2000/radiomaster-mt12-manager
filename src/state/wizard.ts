// The "Add a model" wizard: its steps, the answers gathered so far, and how they become a model.
// Nothing here touches the list of models. That only changes when the person finishes.

import { MT12, type ReceiverTypeId } from '../domain/catalog.ts'
import {
  EXTRA_KINDS,
  featureFrom,
  newExtra,
  problemsInExtra,
  suggestedPort,
  tidied,
  type BasicPorts,
  type ExtraAnswers,
  type ExtraKind,
  type ExtraProblem,
} from '../domain/extras.ts'
import type { Direction, Model, ModelId } from '../domain/model.ts'
import { checkModelName, type ModelNameProblem } from '../domain/modelName.ts'

/** Every step of the wizard, in order. */
export const WIZARD_STEPS = ['name', 'receiver', 'steeringThrottle', 'extras', 'feedback', 'review', 'bind'] as const
export type WizardStepId = (typeof WIZARD_STEPS)[number]

/** The steps that are built so far, in order. Next and Back skip the others. */
export const BUILT_STEPS = ['name', 'receiver', 'steeringThrottle', 'extras', 'review'] as const
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

/** The extras that get a "Common on crawlers" label when the vehicle is a crawler. Nothing is picked for them. */
export const COMMON_ON_CRAWLERS: readonly ExtraKind[] = [
  'twoSpeedTransmission',
  'frontDiffLock',
  'rearDiffLock',
  'lights',
  'cruiseControl',
]

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
  /** The extras picked so far, in the order the wizard lists them. Some may be only half answered. */
  extras: readonly ExtraAnswers[]
  /** How many extras have ever been picked. Used to give each "Something else" an id of its own. */
  extrasPicked: number
}

/** Parts of the wizard's screens that are not answers. */
export interface WizardView {
  /** What is typed in the receiver search. */
  search: string
  /** True while the "I can't find my receiver" panel is open. */
  cantFindOpen: boolean
  /** True while "More options" is open on the steering and throttle step. */
  moreOptionsOpen: boolean
  /** The extra whose questions are showing. Only one is open at a time; the others fold to a summary. */
  openExtraId: string | null
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
      extras: [],
      extrasPicked: 0,
    },
    view: { search: '', cantFindOpen: false, moreOptionsOpen: false, openExtraId: null },
    tried: [],
  }
}

/** The throttle feel to show: the person's pick, or Gentle for a crawler and Standard for anything else. */
export const throttleFeelOf = (draft: ModelDraft): OfferedThrottleFeel =>
  draft.throttleFeel ?? (draft.vehicleKind === 'crawler' ? 'gentle' : 'standard')

/** The receiver ports steering and throttle use, which no extra may share. */
export const basicPortsOf = (draft: ModelDraft): BasicPorts => ({
  steeringPort: draft.steeringPort,
  throttlePort: draft.throttlePort,
})

// Extras: picking one, answering its questions, and taking it away again.

/** Where an extra sits in the list: in the wizard's own order, with each "Something else" after the rest. */
const inListOrder = (extras: readonly ExtraAnswers[]): ExtraAnswers[] =>
  extras.toSorted((first, second) => EXTRA_KINDS.indexOf(first.kind) - EXTRA_KINDS.indexOf(second.kind))

/**
 * Adds an extra to the draft and returns its id too. Every extra but "Something else" can be
 * picked once only. A new extra starts on the lowest free receiver port, or the port its receiver
 * expects.
 */
export function withExtraPicked(draft: ModelDraft, kind: ExtraKind): { draft: ModelDraft; id: string } {
  const already = draft.extras.find((extra) => extra.kind === kind)
  if (already && kind !== 'customExtra') return { draft, id: already.id }
  const picked = draft.extrasPicked + 1
  const id = kind === 'customExtra' ? `customExtra-${picked}` : kind
  const extra: ExtraAnswers = {
    ...newExtra(id, kind),
    port: suggestedPort(kind, draft.extras, basicPortsOf(draft), draft.receiverTypeId),
  }
  return { draft: { ...draft, extras: inListOrder([...draft.extras, extra]), extrasPicked: picked }, id }
}

/** Takes an extra away, with its answers. */
export const withExtraRemoved = (draft: ModelDraft, id: string): ModelDraft => ({
  ...draft,
  extras: draft.extras.filter((extra) => extra.id !== id),
})

/** Records answers for one extra. */
export const withExtraChanged = (draft: ModelDraft, id: string, answers: Partial<ExtraAnswers>): ModelDraft => ({
  ...draft,
  extras: draft.extras.map((extra) => (extra.id === id ? tidied({ ...extra, ...answers, id, kind: extra.kind }) : extra)),
})

/** What is still missing or wrong on each step. Every value is null or empty when the step is fine. */
export interface DraftProblems {
  name: ModelNameProblem | null
  vehicleKind: 'missing' | null
  receiver: 'missing' | null
  ports: 'samePort' | null
  /** For each extra with something missing: its id and what is missing. */
  extras: Readonly<Record<string, readonly ExtraProblem[]>>
}

export function problemsIn(draft: ModelDraft, models: readonly Model[]): DraftProblems {
  const extras: Record<string, readonly ExtraProblem[]> = {}
  for (const extra of draft.extras) {
    const problems = problemsInExtra(extra)
    if (problems.length > 0) extras[extra.id] = problems
  }
  return {
    name: checkModelName(
      draft.name,
      models.map((model) => model.name),
    ),
    vehicleKind: draft.vehicleKind ? null : 'missing',
    receiver: draft.receiverTypeId ? null : 'missing',
    ports: draft.steeringPort === draft.throttlePort ? 'samePort' : null,
    extras,
  }
}

/** True when a step has nothing missing or wrong. */
export function stepIsFine(step: BuiltStepId, problems: DraftProblems): boolean {
  if (step === 'name') return !problems.name && !problems.vehicleKind
  if (step === 'receiver') return !problems.receiver
  if (step === 'steeringThrottle') return !problems.ports
  if (step === 'extras') return Object.keys(problems.extras).length === 0
  return true
}

/** True when every step that asks for answers has them. */
export const everyStepIsFine = (problems: DraftProblems): boolean =>
  BUILT_STEPS.every((step) => stepIsFine(step, problems))

/** The first step before `step` that still needs an answer, or null when the way is clear. */
export function stepBlocking(step: BuiltStepId, problems: DraftProblems): BuiltStepId | null {
  const earlier = BUILT_STEPS.slice(0, BUILT_STEPS.indexOf(step))
  return earlier.find((candidate) => !stepIsFine(candidate, problems)) ?? null
}

/** Turns finished answers into a model. Returns null if an answer is still missing. */
export function modelFrom(draft: ModelDraft, id: ModelId, position: number): Model | null {
  if (!draft.receiverTypeId) return null
  const extras = draft.extras.map(featureFrom)
  if (extras.some((feature) => feature === null)) return null
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
      ...extras.flatMap((feature) => feature ?? []),
    ],
    feedback: [],
  }
}
