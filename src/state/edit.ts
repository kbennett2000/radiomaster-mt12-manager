// Editing a model that is already on the radio, one part at a time.
//
// A model is turned into the same answers the "Add a model" wizard gathers, so the wizard's steps
// can show them. Saving a part changes only that part of the model. Everything else stays exactly
// as it was: the order of its extras, and anything the app leaves alone (see domain/leftAlone.ts).

import { answersFrom, featureFrom, type ExtraAnswers } from '../domain/extras.ts'
import type { Feature, Model } from '../domain/model.ts'
import {
  problemsIn,
  stepIsFine,
  throttleFeelOf,
  type Answering,
  type DraftProblems,
  type ModelDraft,
} from './wizard.ts'

/** The parts of a model that each have a page of their own. Each one is a step of the wizard. */
export const EDIT_PARTS = ['name', 'receiver', 'steeringThrottle', 'extras', 'feedback'] as const
export type EditPart = (typeof EDIT_PARTS)[number]

/** One part of a model while its page is open, with the answers as they stand. Nothing is saved until "Save changes". */
export interface EditState extends Answering {
  modelId: string
  part: EditPart
  /** True once the person has tried to save. Missing answers are only pointed out after that. */
  tried: boolean
}

const steeringOf = (model: Model) => model.features.find((feature) => feature.kind === 'steering')
const throttleOf = (model: Model) => model.features.find((feature) => feature.kind === 'throttle')

/**
 * Each feature of a model with the answers that make it, or null for one that is not an extra.
 * An extra's id is its kind, as in the wizard. Each "Something else" gets a number of its own.
 */
function extrasIn(model: Model): { feature: Feature; answers: ExtraAnswers | null }[] {
  let customs = 0
  return model.features.map((feature) => {
    const id = feature.kind === 'customExtra' ? `customExtra-${++customs}` : feature.kind
    return { feature, answers: answersFrom(feature, id) }
  })
}

/**
 * The wizard's answers for a model that already exists. The kind of vehicle is not part of a
 * model, so it is left unanswered.
 */
export function draftFrom(model: Model): ModelDraft {
  const steering = steeringOf(model)
  const throttle = throttleOf(model)
  const extras = extrasIn(model).flatMap(({ answers }) => answers ?? [])
  return {
    position: model.position,
    name: model.name,
    vehicleKind: null,
    receiverTypeId: model.receiverTypeId,
    steeringDirection: steering?.direction ?? 'normal',
    steeringTravel: steering?.travel ?? 100,
    throttleDirection: throttle?.direction ?? 'normal',
    throttleFeel: throttle?.feel ?? 'standard',
    topSpeed: throttle?.topSpeed ?? 100,
    steeringPort: steering?.port ?? 1,
    throttlePort: throttle?.port ?? 2,
    extras,
    extrasPicked: extras.length,
    lightColour: model.lightColour,
  }
}

/** Opens the page for one part of a model, filled with the model's answers. */
export function openPart(model: Model, part: EditPart, openExtraId: string | null = null): EditState {
  const draft = draftFrom(model)
  const open = draft.extras.some((extra) => extra.id === openExtraId) ? openExtraId : null
  return {
    modelId: model.id,
    part,
    draft,
    view: { search: '', cantFindOpen: false, moreOptionsOpen: false, openExtraId: open },
    tried: false,
  }
}

/** True when two values hold the same answers, whatever order their parts were written in. */
function same(first: unknown, second: unknown): boolean {
  if (first === second) return true
  if (typeof first !== 'object' || typeof second !== 'object' || first === null || second === null) return false
  const keys = new Set([...Object.keys(first), ...Object.keys(second)])
  return [...keys].every((key) =>
    same((first as Record<string, unknown>)[key], (second as Record<string, unknown>)[key]),
  )
}

/** The answers one part's page can change, pulled out so two sets can be compared. */
function answersOf(part: EditPart, draft: ModelDraft): unknown {
  const byId = (pick: (extra: ExtraAnswers) => unknown) =>
    Object.fromEntries(draft.extras.map((extra) => [extra.id, pick(extra)]))
  switch (part) {
    case 'name':
      return draft.name.trim()
    case 'receiver':
      return draft.receiverTypeId
    case 'steeringThrottle':
      return [
        draft.steeringDirection,
        draft.steeringTravel,
        draft.steeringPort,
        draft.throttleDirection,
        throttleFeelOf(draft),
        draft.topSpeed,
        draft.throttlePort,
      ]
    case 'extras':
      return byId((extra) => ({ ...extra, feedback: null }))
    case 'feedback':
      return { lightColour: draft.lightColour, extras: byId((extra) => extra.feedback) }
  }
}

/** True when the answers on a part's page differ from what the model has. */
export const partHasChanges = (model: Model, part: EditPart, draft: ModelDraft): boolean =>
  !same(answersOf(part, draft), answersOf(part, draftFrom(model)))

/** The extras that differ between two versions of a model, as their answers. */
export function extrasChangedBetween(
  was: Model,
  now: Model,
): { added: ExtraAnswers[]; removed: ExtraAnswers[]; changed: ExtraAnswers[] } {
  const before = draftFrom(was).extras
  const after = draftFrom(now).extras
  const earlier = (extra: ExtraAnswers) => before.find((other) => other.id === extra.id)
  return {
    added: after.filter((extra) => !earlier(extra)),
    removed: before.filter((extra) => !after.some((other) => other.id === extra.id)),
    changed: after.filter((extra) => earlier(extra) && !same(extra, earlier(extra))),
  }
}

/**
 * What is missing or wrong in the answers for a model being edited. The same checks as the
 * wizard, except that a model may keep its own name.
 */
export const problemsInEdit = (model: Model, draft: ModelDraft, models: readonly Model[]): DraftProblems =>
  problemsIn(
    draft,
    models.filter((other) => other.id !== model.id),
  )

/** True when a part's page has nothing missing or wrong, so it can be saved. */
export const partIsFine = (part: EditPart, problems: DraftProblems): boolean =>
  // The wizard's first step also asks for the kind of vehicle. Editing the name does not.
  part === 'name' ? problems.name === null : stepIsFine(part, problems)

/**
 * The model with its extras as the answers have them. An extra that was not touched stays as it
 * is, in its place. One that was taken away goes, and a new one is added after the rest. Anything
 * that is not an extra is never touched.
 */
function withExtrasFrom(model: Model, draft: ModelDraft): Model {
  const before = extrasIn(model)
  const kept = before.flatMap(({ feature, answers }) => {
    if (!answers) return [feature]
    const now = draft.extras.find((extra) => extra.id === answers.id)
    if (!now) return []
    return same(now, answers) ? [feature] : (featureFrom(now) ?? feature)
  })
  const known = new Set(before.flatMap(({ answers }) => answers?.id ?? []))
  const added = draft.extras.filter((extra) => !known.has(extra.id)).flatMap((extra) => featureFrom(extra) ?? [])
  return { ...model, features: [...kept, ...added] }
}

/** The model with one part changed to match the answers. Every other part is left exactly as it was. */
export function withPartSaved(model: Model, part: EditPart, draft: ModelDraft): Model {
  switch (part) {
    case 'name':
      return { ...model, name: draft.name.trim() }
    case 'receiver':
      return draft.receiverTypeId ? { ...model, receiverTypeId: draft.receiverTypeId } : model
    case 'steeringThrottle':
      return {
        ...model,
        features: model.features.map((feature): Feature => {
          if (feature.kind === 'steering') {
            return { ...feature, port: draft.steeringPort, direction: draft.steeringDirection, travel: draft.steeringTravel }
          }
          if (feature.kind === 'throttle') {
            return {
              ...feature,
              port: draft.throttlePort,
              direction: draft.throttleDirection,
              feel: throttleFeelOf(draft),
              topSpeed: draft.topSpeed,
            }
          }
          return feature
        }),
      }
    case 'extras':
      return withExtrasFrom(model, draft)
    case 'feedback':
      // Feedback for one extra is kept on that extra. Feedback set for the whole model on the
      // radio is left alone.
      return { ...withExtrasFrom(model, draft), lightColour: draft.lightColour }
  }
}
