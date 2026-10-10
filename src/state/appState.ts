// Everything the mockup remembers, and every way it can change.
// The screens only read this state and dispatch these actions.
// Where a model goes is always decided by the position rules in src/domain/positions.ts.

import { DEFAULT_RADIO_MODULE_ID, MT12, type RadioSetup } from '../domain/catalog.ts'
import type { Model, ModelId } from '../domain/model.ts'
import {
  closeUpEmptyPlaces,
  describeMove,
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
import type { BaseFitting } from '../domain/radio.ts'

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
  | { kind: 'copied'; modelName: string; position: number }
  /** `shift` is null when the model's place was left empty and nothing else moved. */
  | { kind: 'deleted'; modelId: ModelId; modelName: string; position: number; shift: Shift | null; before: Before }
  | { kind: 'moved'; modelId: ModelId; modelName: string; position: number; before: Before }
  | { kind: 'emptyMoved'; fromPosition: number; position: number; before: Before }
  | { kind: 'closedUp'; modelCount: number; before: Before }
  | { kind: 'restored'; modelName: string; position: number; shift: Shift }
  | { kind: 'undone' }
  | { kind: 'radioSetupSaved' }

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
  /** The models on the radio, lowest position first. */
  models: readonly Model[]
  /** The model the radio is currently set to. */
  currentModelId: ModelId | null
  /** Deleted models, newest first. Each keeps the position it was deleted from. */
  recentlyDeleted: readonly Model[]
  /** The confirmation shown after the last change. */
  notice: Notice | null
  dialog: OpenDialog | null
  /** Used to give each copy its own id. */
  nextCopyNumber: number
}

export type Action =
  | { type: 'connectStarted' }
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
    models: [],
    currentModelId: null,
    recentlyDeleted: [],
    notice: null,
    dialog: null,
    nextCopyNumber: 1,
  }
}

export const isRadioFull = (state: AppState): boolean => state.models.length >= MT12.maxModels

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
      return { ...state, connection: 'connecting', justDisconnected: false }

    case 'connectSucceeded':
      // A radio that was unplugged and plugged in again still has what was saved to it.
      if (state.radioLoaded) return { ...state, connection: 'connected', justDisconnected: false }
      return {
        ...state,
        connection: 'connected',
        radioLoaded: true,
        justDisconnected: false,
        models: action.models,
        currentModelId: action.currentModelId,
        recentlyDeleted: [],
        notice: null,
        dialog: null,
      }

    case 'disconnected':
      return { ...state, connection: 'notConnected', justDisconnected: true, notice: null, dialog: null }

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

    case 'dialogClosed':
      return { ...state, dialog: null }

    case 'noticeDismissed':
      return { ...state, notice: null }
  }
}
