// Everything the app remembers, and every way it can change.
// The screens only read this state and dispatch these actions.
// Where a model goes is always decided by the position rules in src/domain/positions.ts.
//
// The app shows one of two things once it is connected: what it read from a real card, which it
// only reads, or the sample models, which can be changed in every way the screens allow.

import { DEFAULT_RADIO_MODULE_ID, MT12, type RadioSetup } from '../domain/catalog.ts'
import type { Model, ModelId } from '../domain/model.ts'
import {
  closeUpEmptyPlaces,
  describeMove,
  firstEmptyPosition,
  modelAt,
  modelsAfter,
  movePlace,
  placeForCopy,
  placeModel,
  removeAndCloseUp,
  removeModel,
  restoreModel,
  type WhenDeleting,
} from '../domain/positions.ts'
import type { ExtraAnswers, ExtraKind } from '../domain/extras.ts'
import type { BaseFitting } from '../domain/radio.ts'
import type { CardReading } from '../files/card.ts'
import {
  openPart,
  partHasChanges,
  partIsFine,
  problemsInEdit,
  withPartSaved,
  type EditPart,
  type EditState,
} from './edit.ts'
import {
  answered,
  everyStepIsFine,
  extraChanged,
  extraPicked,
  extraRemoved,
  modelFrom,
  newWizard,
  problemsIn,
  unfinishedExtraOpened,
  type BuiltStepId,
  type ModelDraft,
  type WizardState,
  type WizardView,
} from './wizard.ts'

export type ConnectionStatus = 'notConnected' | 'connecting' | 'wrongFolder' | 'connected'

/** The parts of the state a change to the list touches, kept so Undo can put all of them back. */
interface Before {
  models: readonly Model[]
  currentModelId: ModelId | null
  recentlyDeleted: readonly Model[]
}

/** Other models that changed place because of a change, so the confirmation can say so. */
export interface Shift {
  count: number
  /** The positions the first and last of them were in before the change. */
  first: number
  last: number
  /** Which way they went: 'up' is toward position 1. */
  direction: 'up' | 'down'
  /** The name of the model, when only one moved. */
  onlyName: string | null
}

export type Notice =
  | { kind: 'added'; modelName: string; position: number }
  | { kind: 'copied'; modelName: string; position: number }
  /** `shift` is null when the model's place was left empty and nothing else moved. */
  | { kind: 'deleted'; modelId: ModelId; modelName: string; position: number; shift: Shift | null; before: Before }
  | { kind: 'moved'; modelId: ModelId; modelName: string; position: number; before: Before }
  | { kind: 'emptyMoved'; fromPosition: number; position: number; before: Before }
  | { kind: 'closedUp'; modelCount: number; before: Before }
  | { kind: 'restored'; modelName: string; position: number; shift: Shift }
  /** One part of a model was changed on its Edit page. `was` and `now` are the model before and after. */
  | { kind: 'edited'; modelId: ModelId; part: EditPart; was: Model; now: Model; before: Before }
  /** A change made on a model's Edit page was undone. */
  | { kind: 'editUndone'; modelId: ModelId; modelName: string }
  | { kind: 'undone' }
  | { kind: 'radioSetupSaved' }

/** A notice about a change made on a model's Edit page. It is shown there, and in the list. */
export type EditChange = Extract<Notice, { kind: 'edited' | 'editUndone' }>

export const isEditChange = (notice: Notice | null): notice is EditChange =>
  notice?.kind === 'edited' || notice?.kind === 'editUndone'

export type OpenDialog =
  | { type: 'copy'; modelId: ModelId; draftName?: string }
  /** Moves whatever is in `fromPosition`: a model or an empty place. */
  | { type: 'move'; fromPosition: number; toPosition?: number }
  | { type: 'delete'; modelId: ModelId; switchToId?: ModelId; triedWithoutPicking?: boolean }
  | { type: 'radioFull' }

export interface AppState {
  /** Whether this browser can open the radio's drive. Chrome and Edge can. */
  browserSupported: boolean
  connection: ConnectionStatus
  /** True once the radio's models have been loaded. Unplugging and connecting again keeps them. */
  radioLoaded: boolean
  /** True after "I've unplugged it", until the next connect. */
  justDisconnected: boolean
  radio: RadioSetup
  /** What a delete does to the rest of the list. Chosen in Radio setup. */
  whenDeleting: WhenDeleting
  /** What was read from a real card. Null when the app is showing the sample models. */
  card: CardReading | null
  /** The sample models, lowest position first. Empty while a real card is shown. */
  models: readonly Model[]
  /** The model the radio is currently set to. */
  currentModelId: ModelId | null
  /** Deleted models, newest first. Each keeps the position it was deleted from. */
  recentlyDeleted: readonly Model[]
  /** The confirmation shown after the last change. */
  notice: Notice | null
  dialog: OpenDialog | null
  /** The "Add a model" wizard while it is open, with the answers so far. */
  wizard: WizardState | null
  /** The page for one part of a model while it is open, with the answers as they stand. */
  edit: EditState | null
  /** A model that was just added. The list scrolls to its row and marks it for a moment. */
  newModelId: ModelId | null
  /**
   * The model the wizard added last. Its "Bind your receiver" page can be shown for it, and shown
   * again if the person comes back to that page. It lasts until another wizard is opened.
   */
  lastAddedModelId: ModelId | null
  /** Used to give each copy and each added model its own id. */
  nextCopyNumber: number
}

export type Action =
  | { type: 'connectStarted' }
  /** The folder picker was closed without a folder being chosen. */
  | { type: 'connectCancelled' }
  /** The folder that was picked is not a radio's card. */
  | { type: 'wrongFolderPicked' }
  /** A real card was read. */
  | { type: 'cardConnected'; reading: CardReading }
  /** The sample models were asked for. */
  | { type: 'connectSucceeded'; models: readonly Model[]; currentModelId: ModelId | null }
  | { type: 'disconnected' }
  | { type: 'baseFittingAnswered'; baseFitting: BaseFitting }
  | { type: 'radioSetupSaved'; baseFitting: BaseFitting; whenDeleting: WhenDeleting }
  | { type: 'addRequestedWhileFull' }
  | { type: 'copyRequested'; modelId: ModelId }
  | { type: 'copyConfirmed'; modelId: ModelId; name: string }
  | { type: 'moveRequested'; position: number }
  | { type: 'placeMoved'; fromPosition: number; toPosition: number }
  | { type: 'emptyPlacesClosedUp' }
  | { type: 'deleteRequested'; modelId: ModelId }
  | { type: 'deleteConfirmed'; modelId: ModelId; switchToId?: ModelId }
  | { type: 'changeUndone' }
  | { type: 'restoreRequested'; modelId: ModelId }
  /** Opens the wizard. `position` is the empty place it was opened from, if any. */
  | { type: 'wizardOpened'; position?: number }
  | { type: 'wizardStepShown'; step: BuiltStepId }
  | { type: 'wizardChanged'; draft?: Partial<ModelDraft>; view?: Partial<WizardView> }
  /** An extra was picked on step 4. Its questions open under it. */
  | { type: 'wizardExtraPicked'; kind: ExtraKind }
  | { type: 'wizardExtraRemoved'; id: string }
  | { type: 'wizardExtraChanged'; id: string; answers: Partial<ExtraAnswers> }
  /** The person tried to move on from a step, so anything missing on it should now be pointed out. */
  | { type: 'wizardStepTried'; step: BuiltStepId }
  | { type: 'wizardLeft' }
  | { type: 'wizardFinished' }
  /** Opens the page for one part of a model. `openExtraId` is the extra whose questions should show. */
  | { type: 'editOpened'; modelId: ModelId; part: EditPart; openExtraId?: string }
  | { type: 'editChanged'; draft?: Partial<ModelDraft>; view?: Partial<WizardView> }
  | { type: 'editExtraPicked'; kind: ExtraKind }
  | { type: 'editExtraRemoved'; id: string }
  | { type: 'editExtraChanged'; id: string; answers: Partial<ExtraAnswers> }
  /** The person tried to save, so anything missing on the page should now be pointed out. */
  | { type: 'editTried' }
  /** "Save changes": saves the part that is open and closes its page. */
  | { type: 'editSaved' }
  /** The page was left without saving. */
  | { type: 'editLeft' }
  /** The list has shown the mark on a newly added row for long enough. */
  | { type: 'newModelMarked' }
  | { type: 'dialogClosed' }
  | { type: 'noticeDismissed' }

export function initialState(browserSupported: boolean): AppState {
  return {
    browserSupported,
    connection: 'notConnected',
    radioLoaded: false,
    justDisconnected: false,
    radio: { moduleId: DEFAULT_RADIO_MODULE_ID, baseFitting: null },
    whenDeleting: 'closeUp',
    card: null,
    models: [],
    currentModelId: null,
    recentlyDeleted: [],
    notice: null,
    dialog: null,
    wizard: null,
    edit: null,
    newModelId: null,
    lastAddedModelId: null,
    nextCopyNumber: 1,
  }
}

export const isRadioFull = (state: AppState): boolean => state.models.length >= MT12.maxModels

/** How many models there are to show: the ones on the real card, or the sample ones. */
export const modelCountOf = (state: AppState): number => (state.card ? state.card.models.length : state.models.length)

/** True once the radio is connected and the app knows what is on its base. */
export const isReady = (state: AppState): boolean =>
  state.connection === 'connected' && state.radio.baseFitting !== null

const before = (state: AppState): Before => ({
  models: state.models,
  currentModelId: state.currentModelId,
  recentlyDeleted: state.recentlyDeleted,
})

/** Sums up a group of models that all moved one place the same way. `moved` is how they stood before. */
export function shiftOf(moved: readonly Model[], direction: 'up' | 'down'): Shift {
  return {
    count: moved.length,
    first: moved[0]?.position ?? 0,
    last: moved[moved.length - 1]?.position ?? 0,
    direction,
    onlyName: moved.length === 1 ? moved[0].name : null,
  }
}

const nothingMoved: Shift = shiftOf([], 'down')

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'connectStarted':
      return { ...state, connection: 'connecting' }

    case 'connectCancelled':
      return { ...state, connection: 'notConnected' }

    case 'wrongFolderPicked':
      return { ...state, connection: 'wrongFolder', justDisconnected: false }

    case 'cardConnected':
      // A real card is shown on its own. Sample models from an earlier try are put away.
      return {
        ...state,
        connection: 'connected',
        radioLoaded: false,
        justDisconnected: false,
        card: action.reading,
        models: [],
        currentModelId: null,
        recentlyDeleted: [],
        notice: null,
        dialog: null,
        wizard: null,
        edit: null,
        newModelId: null,
        lastAddedModelId: null,
      }

    case 'connectSucceeded':
      // Sample models that were unplugged and connected again still have what was saved to them.
      if (state.radioLoaded) return { ...state, connection: 'connected', justDisconnected: false, card: null }
      return {
        ...state,
        connection: 'connected',
        radioLoaded: true,
        justDisconnected: false,
        card: null,
        models: action.models,
        currentModelId: action.currentModelId,
        recentlyDeleted: [],
        notice: null,
        dialog: null,
      }

    case 'disconnected':
      return {
        ...state,
        connection: 'notConnected',
        justDisconnected: true,
        // What was read from a real card is not kept once the card is unplugged.
        card: null,
        notice: null,
        dialog: null,
        wizard: null,
        edit: null,
        newModelId: null,
        lastAddedModelId: null,
      }

    case 'baseFittingAnswered':
      return { ...state, radio: { ...state.radio, baseFitting: action.baseFitting } }

    case 'radioSetupSaved':
      return {
        ...state,
        radio: { ...state.radio, baseFitting: action.baseFitting },
        whenDeleting: action.whenDeleting,
        notice: { kind: 'radioSetupSaved' },
      }

    case 'addRequestedWhileFull':
      return { ...state, dialog: { type: 'radioFull' } }

    case 'copyRequested':
      return { ...state, dialog: isRadioFull(state) ? { type: 'radioFull' } : { type: 'copy', modelId: action.modelId } }

    case 'copyConfirmed': {
      const original = state.models.find((model) => model.id === action.modelId)
      if (!original) return { ...state, dialog: null }
      const position = placeForCopy(state.models, original.position)
      if (position === null) return { ...state, dialog: { type: 'radioFull' } }
      const copy: Model = { ...original, id: `copy-${state.nextCopyNumber}`, name: action.name.trim() }
      return {
        ...state,
        models: placeModel(state.models, copy, position),
        nextCopyNumber: state.nextCopyNumber + 1,
        notice: { kind: 'copied', modelName: copy.name, position },
        dialog: null,
      }
    }

    case 'moveRequested':
      return { ...state, dialog: { type: 'move', fromPosition: action.position } }

    case 'placeMoved': {
      const { fromPosition, toPosition } = action
      const model = modelAt(state.models, fromPosition)
      const changesNothing =
        fromPosition === toPosition ||
        (!model && describeMove(state.models, fromPosition, toPosition).shifted.length === 0)
      if (changesNothing) return { ...state, dialog: null }
      return {
        ...state,
        models: movePlace(state.models, fromPosition, toPosition),
        notice: model
          ? { kind: 'moved', modelId: model.id, modelName: model.name, position: toPosition, before: before(state) }
          : { kind: 'emptyMoved', fromPosition, position: toPosition, before: before(state) },
        dialog: null,
      }
    }

    case 'emptyPlacesClosedUp':
      return {
        ...state,
        models: closeUpEmptyPlaces(state.models),
        notice: { kind: 'closedUp', modelCount: state.models.length, before: before(state) },
      }

    case 'deleteRequested':
      return { ...state, dialog: { type: 'delete', modelId: action.modelId } }

    case 'deleteConfirmed': {
      const model = state.models.find((candidate) => candidate.id === action.modelId)
      if (!model) return { ...state, dialog: null }
      const closeUp = state.whenDeleting === 'closeUp'
      const remaining = closeUp ? removeAndCloseUp(state.models, model.id) : removeModel(state.models, model.id)
      const wasCurrent = state.currentModelId === model.id
      if (wasCurrent && remaining.length > 0 && !remaining.some((other) => other.id === action.switchToId)) {
        // The radio must be told which model to switch to before its current one can go.
        return { ...state, dialog: { type: 'delete', modelId: model.id, triedWithoutPicking: true } }
      }
      return {
        ...state,
        models: remaining,
        currentModelId: wasCurrent ? (action.switchToId ?? null) : state.currentModelId,
        recentlyDeleted: [model, ...state.recentlyDeleted],
        notice: {
          kind: 'deleted',
          modelId: model.id,
          modelName: model.name,
          position: model.position,
          shift: closeUp ? shiftOf(modelsAfter(state.models, model.position), 'up') : null,
          before: before(state),
        },
        dialog: null,
      }
    }

    case 'changeUndone': {
      const undone = state.notice
      if (!undone || !('before' in undone)) return state
      const back = { ...state, ...undone.before }
      if (undone.kind === 'deleted' || undone.kind === 'moved') {
        // Say where the model is again. Nothing else can have changed since, so it is its old place.
        const position = undone.before.models.find((model) => model.id === undone.modelId)?.position ?? undone.position
        return { ...back, notice: { kind: 'restored', modelName: undone.modelName, position, shift: nothingMoved } }
      }
      if (undone.kind === 'edited') {
        return { ...back, notice: { kind: 'editUndone', modelId: undone.modelId, modelName: undone.was.name } }
      }
      return { ...back, notice: { kind: 'undone' } }
    }

    case 'restoreRequested': {
      const deleted = state.recentlyDeleted.find((model) => model.id === action.modelId)
      if (!deleted) return state
      const restored = restoreModel(state.models, deleted)
      if (!restored) return { ...state, dialog: { type: 'radioFull' } }
      return {
        ...state,
        models: restored.models,
        currentModelId: state.currentModelId ?? deleted.id,
        recentlyDeleted: state.recentlyDeleted.filter((model) => model !== deleted),
        notice: {
          kind: 'restored',
          modelName: deleted.name,
          position: deleted.position,
          shift: shiftOf(restored.moved, restored.direction),
        },
      }
    }

    case 'wizardOpened': {
      const requested = action.position
      const position =
        requested !== undefined && !modelAt(state.models, requested) ? requested : firstEmptyPosition(state.models)
      if (position === null) return { ...state, dialog: { type: 'radioFull' } }
      return { ...state, wizard: newWizard(position), edit: null, lastAddedModelId: null, notice: null, dialog: null }
    }

    case 'wizardStepShown':
      return state.wizard ? { ...state, wizard: { ...state.wizard, step: action.step } } : state

    case 'wizardChanged':
      return state.wizard ? { ...state, wizard: answered(state.wizard, action.draft, action.view) } : state

    case 'wizardExtraPicked':
      return state.wizard ? { ...state, wizard: extraPicked(state.wizard, action.kind) } : state

    case 'wizardExtraRemoved':
      return state.wizard ? { ...state, wizard: extraRemoved(state.wizard, action.id) } : state

    case 'wizardExtraChanged':
      return state.wizard ? { ...state, wizard: extraChanged(state.wizard, action.id, action.answers) } : state

    case 'wizardStepTried': {
      const wizard = state.wizard
      if (!wizard) return state
      const tried = wizard.tried.includes(action.step) ? wizard.tried : [...wizard.tried, action.step]
      // On the extras step, open the first extra that still needs an answer, so the message about it shows.
      const marked = { ...wizard, tried }
      return { ...state, wizard: action.step === 'extras' ? unfinishedExtraOpened(marked) : marked }
    }

    case 'wizardLeft':
      return { ...state, wizard: null }

    case 'wizardFinished': {
      const wizard = state.wizard
      if (!wizard) return state
      const problems = problemsIn(wizard.draft, state.models)
      const taken = modelAt(state.models, wizard.draft.position)
      const position = taken ? firstEmptyPosition(state.models) : wizard.draft.position
      const model =
        position === null ? null : modelFrom(wizard.draft, `added-${state.nextCopyNumber}`, position)
      // Nothing is added unless every answer is in. The wizard stays open so the person can fix it.
      if (!model || !everyStepIsFine(problems)) return state
      return {
        ...state,
        models: placeModel(state.models, model, model.position),
        // A radio with no models had nothing to be set to, so it is set to the first one added.
        currentModelId: state.currentModelId ?? model.id,
        nextCopyNumber: state.nextCopyNumber + 1,
        notice: { kind: 'added', modelName: model.name, position: model.position },
        wizard: null,
        newModelId: model.id,
        lastAddedModelId: model.id,
      }
    }

    case 'editOpened': {
      const model = state.models.find((candidate) => candidate.id === action.modelId)
      if (!model) return state
      return { ...state, edit: openPart(model, action.part, action.openExtraId), notice: null, dialog: null }
    }

    case 'editChanged':
      return state.edit ? { ...state, edit: answered(state.edit, action.draft, action.view) } : state

    case 'editExtraPicked':
      return state.edit ? { ...state, edit: extraPicked(state.edit, action.kind) } : state

    case 'editExtraRemoved':
      return state.edit ? { ...state, edit: extraRemoved(state.edit, action.id) } : state

    case 'editExtraChanged':
      return state.edit ? { ...state, edit: extraChanged(state.edit, action.id, action.answers) } : state

    case 'editTried': {
      if (!state.edit) return state
      const marked = { ...state.edit, tried: true }
      return { ...state, edit: state.edit.part === 'extras' ? unfinishedExtraOpened(marked) : marked }
    }

    case 'editSaved': {
      const edit = state.edit
      const model = edit && state.models.find((candidate) => candidate.id === edit.modelId)
      if (!edit || !model) return { ...state, edit: null }
      // Nothing is saved while an answer is missing or wrong. The page stays open so it can be fixed.
      if (!partIsFine(edit.part, problemsInEdit(model, edit.draft, state.models))) return state
      // Saving with nothing changed just closes the page.
      if (!partHasChanges(model, edit.part, edit.draft)) return { ...state, edit: null }
      const saved = withPartSaved(model, edit.part, edit.draft)
      return {
        ...state,
        models: state.models.map((other) => (other.id === model.id ? saved : other)),
        notice: { kind: 'edited', modelId: model.id, part: edit.part, was: model, now: saved, before: before(state) },
        edit: null,
      }
    }

    case 'editLeft':
      return { ...state, edit: null }

    case 'newModelMarked':
      return { ...state, newModelId: null }

    case 'dialogClosed':
      return { ...state, dialog: null }

    case 'noticeDismissed':
      return { ...state, notice: null }
  }
}
