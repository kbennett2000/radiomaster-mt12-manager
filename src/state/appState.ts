// Everything the mockup remembers, and every way it can change.
// The screens only read this state and dispatch these actions.

import { DEFAULT_RADIO_MODULE_ID, MT12, type RadioSetup } from '../domain/catalog.ts'
import type { DeletedModel, Model, ModelId } from '../domain/model.ts'
import type { BaseFitting } from '../domain/radio.ts'

export type ConnectionStatus = 'notConnected' | 'connecting' | 'wrongFolder' | 'connected'

/** The parts of the state a delete changes, kept so Undo can put all of them back. */
interface BeforeDelete {
  models: readonly Model[]
  currentModelId: ModelId | null
  recentlyDeleted: readonly DeletedModel[]
}

export type Notice =
  | { kind: 'copied'; modelName: string }
  | { kind: 'deleted'; modelName: string; before: BeforeDelete }
  | { kind: 'restored'; modelName: string }
  | { kind: 'radioSetupSaved' }

export type OpenDialog =
  | { type: 'copy'; modelId: ModelId; draftName?: string }
  | { type: 'delete'; modelId: ModelId; switchToId?: ModelId; triedWithoutPicking?: boolean }
  | { type: 'radioFull' }

export interface AppState {
  /** Whether this browser can open the radio's drive. Chrome and Edge can. */
  browserSupported: boolean
  connection: ConnectionStatus
  radio: RadioSetup
  models: readonly Model[]
  /** The model the radio is currently set to. */
  currentModelId: ModelId | null
  recentlyDeleted: readonly DeletedModel[]
  /** The confirmation shown after the last change. */
  notice: Notice | null
  dialog: OpenDialog | null
  /** Used to give each copy its own id. */
  nextCopyNumber: number
}

export type Action =
  | { type: 'connectStarted' }
  | { type: 'connectSucceeded'; models: readonly Model[]; currentModelId: ModelId | null }
  | { type: 'baseFittingAnswered'; baseFitting: BaseFitting }
  | { type: 'radioSetupSaved'; baseFitting: BaseFitting }
  | { type: 'addRequestedWhileFull' }
  | { type: 'copyRequested'; modelId: ModelId }
  | { type: 'copyConfirmed'; modelId: ModelId; name: string }
  | { type: 'deleteRequested'; modelId: ModelId }
  | { type: 'deleteConfirmed'; modelId: ModelId; switchToId?: ModelId }
  | { type: 'deleteUndone' }
  | { type: 'restoreRequested'; modelId: ModelId }
  | { type: 'dialogClosed' }
  | { type: 'noticeDismissed' }

export function initialState(browserSupported: boolean): AppState {
  return {
    browserSupported,
    connection: 'notConnected',
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

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'connectStarted':
      return { ...state, connection: 'connecting' }

    case 'connectSucceeded':
      return {
        ...state,
        connection: 'connected',
        models: action.models,
        currentModelId: action.currentModelId,
        recentlyDeleted: [],
        notice: null,
        dialog: null,
      }

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
      const index = state.models.findIndex((model) => model.id === action.modelId)
      if (index === -1 || isRadioFull(state)) return { ...state, dialog: null }
      const copy: Model = {
        ...state.models[index],
        id: `copy-${state.nextCopyNumber}`,
        name: action.name.trim(),
      }
      // The copy lands right after its original, so it is easy to spot.
      return {
        ...state,
        models: state.models.toSpliced(index + 1, 0, copy),
        nextCopyNumber: state.nextCopyNumber + 1,
        notice: { kind: 'copied', modelName: copy.name },
        dialog: null,
      }
    }

    case 'deleteRequested':
      return { ...state, dialog: { type: 'delete', modelId: action.modelId } }

    case 'deleteConfirmed': {
      const index = state.models.findIndex((model) => model.id === action.modelId)
      if (index === -1) return { ...state, dialog: null }
      const model = state.models[index]
      const remaining = state.models.toSpliced(index, 1)
      const wasCurrent = state.currentModelId === model.id
      if (wasCurrent && remaining.length > 0 && !remaining.some((other) => other.id === action.switchToId)) {
        // The radio must be told which model to switch to before its current one can go.
        return { ...state, dialog: { type: 'delete', modelId: model.id, triedWithoutPicking: true } }
      }
      return {
        ...state,
        models: remaining,
        currentModelId: wasCurrent ? (action.switchToId ?? null) : state.currentModelId,
        recentlyDeleted: [
          { model, afterModelId: state.models[index - 1]?.id ?? null, position: index },
          ...state.recentlyDeleted,
        ],
        notice: {
          kind: 'deleted',
          modelName: model.name,
          before: {
            models: state.models,
            currentModelId: state.currentModelId,
            recentlyDeleted: state.recentlyDeleted,
          },
        },
        dialog: null,
      }
    }

    case 'deleteUndone': {
      if (state.notice?.kind !== 'deleted') return state
      return {
        ...state,
        ...state.notice.before,
        notice: { kind: 'restored', modelName: state.notice.modelName },
      }
    }

    case 'restoreRequested': {
      const deleted = state.recentlyDeleted.find((entry) => entry.model.id === action.modelId)
      if (!deleted) return state
      if (isRadioFull(state)) return { ...state, dialog: { type: 'radioFull' } }
      const neighbour = state.models.findIndex((model) => model.id === deleted.afterModelId)
      let position = Math.min(deleted.position, state.models.length)
      if (deleted.afterModelId === null) position = 0
      else if (neighbour !== -1) position = neighbour + 1
      return {
        ...state,
        models: state.models.toSpliced(position, 0, deleted.model),
        currentModelId: state.currentModelId ?? deleted.model.id,
        recentlyDeleted: state.recentlyDeleted.filter((entry) => entry !== deleted),
        notice: { kind: 'restored', modelName: deleted.model.name },
      }
    }

    case 'dialogClosed':
      return { ...state, dialog: null }

    case 'noticeDismissed':
      return { ...state, notice: null }
  }
}
