// Everything the mockup remembers, and every way it can change.
// The screens only read this state and dispatch these actions.
// Where a model goes is always decided by the position rules in src/domain/positions.ts.

import { DEFAULT_RADIO_MODULE_ID, MT12, type RadioSetup } from '../domain/catalog.ts'
import type { Model, ModelId } from '../domain/model.ts'
import { moveModel, placeForCopy, placeForRestore, placeModel, removeModel } from '../domain/positions.ts'
import type { BaseFitting } from '../domain/radio.ts'

export type ConnectionStatus = 'notConnected' | 'connecting' | 'wrongFolder' | 'connected'

/** The parts of the state a delete or a move changes, kept so Undo can put all of them back. */
interface Before {
  models: readonly Model[]
  currentModelId: ModelId | null
  recentlyDeleted: readonly Model[]
}

export type Notice =
  | { kind: 'copied'; modelName: string; position: number }
  | { kind: 'deleted'; modelId: ModelId; modelName: string; position: number; before: Before }
  | { kind: 'moved'; modelId: ModelId; modelName: string; position: number; before: Before }
  /** `wantedPosition` is where the model used to be. It differs from `position` when that place was taken. */
  | { kind: 'restored'; modelName: string; position: number; wantedPosition: number }
  | { kind: 'radioSetupSaved' }

export type OpenDialog =
  | { type: 'copy'; modelId: ModelId; draftName?: string }
  | { type: 'move'; modelId: ModelId; toPosition?: number }
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
  | { type: 'radioSetupSaved'; baseFitting: BaseFitting }
  | { type: 'addRequestedWhileFull' }
  | { type: 'copyRequested'; modelId: ModelId }
  | { type: 'copyConfirmed'; modelId: ModelId; name: string }
  | { type: 'moveRequested'; modelId: ModelId }
  | { type: 'modelMoved'; modelId: ModelId; toPosition: number }
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
      return { ...state, dialog: { type: 'move', modelId: action.modelId } }

    case 'modelMoved': {
      const model = state.models.find((candidate) => candidate.id === action.modelId)
      if (!model || model.position === action.toPosition) return { ...state, dialog: null }
      return {
        ...state,
        models: moveModel(state.models, model.id, action.toPosition),
        notice: {
          kind: 'moved',
          modelId: model.id,
          modelName: model.name,
          position: action.toPosition,
          before: before(state),
        },
        dialog: null,
      }
    }

    case 'deleteRequested':
      return { ...state, dialog: { type: 'delete', modelId: action.modelId } }

    case 'deleteConfirmed': {
      const model = state.models.find((candidate) => candidate.id === action.modelId)
      if (!model) return { ...state, dialog: null }
      const remaining = removeModel(state.models, model.id)
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
          before: before(state),
        },
        dialog: null,
      }
    }

    case 'changeUndone': {
      const undone = state.notice
      if (undone?.kind !== 'deleted' && undone?.kind !== 'moved') return state
      // Nothing else can have changed since, so the model's old place is still free.
      const backAt = undone.before.models.find((model) => model.id === undone.modelId)?.position ?? undone.position
      return {
        ...state,
        ...undone.before,
        notice: { kind: 'restored', modelName: undone.modelName, position: backAt, wantedPosition: backAt },
      }
    }

    case 'restoreRequested': {
      const deleted = state.recentlyDeleted.find((model) => model.id === action.modelId)
      if (!deleted) return state
      const position = placeForRestore(state.models, deleted.position)
      if (position === null) return { ...state, dialog: { type: 'radioFull' } }
      return {
        ...state,
        models: placeModel(state.models, deleted, position),
        currentModelId: state.currentModelId ?? deleted.id,
        recentlyDeleted: state.recentlyDeleted.filter((model) => model !== deleted),
        notice: { kind: 'restored', modelName: deleted.name, position, wantedPosition: deleted.position },
      }
    }

    case 'dialogClosed':
      return { ...state, dialog: null }

    case 'noticeDismissed':
      return { ...state, notice: null }
  }
}
