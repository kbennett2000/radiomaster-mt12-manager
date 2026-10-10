// Every state a reviewer should be able to look at, each reachable with one click from the reviewer panel.
// The screenshot script reads the same list, so the saved pictures cover exactly these states.
// Where a real click path exists, the state is built by running the real actions through the reducer.

import { FULL_RADIO_MODELS } from '../sample/fullRadio.ts'
import { SAMPLE_CURRENT_MODEL_ID, SAMPLE_MODELS } from '../sample/sampleModels.ts'
import type { Model, ModelId } from '../domain/model.ts'
import type { BaseFitting } from '../domain/radio.ts'
import { initialState, reducer, type Action, type AppState } from './appState.ts'
import { paths } from './useHashRoute.ts'

export type ScenarioGroup = 'connect' | 'models' | 'delete' | 'finish'

export const SCENARIO_GROUPS: readonly ScenarioGroup[] = ['connect', 'models', 'delete', 'finish']

export const SCENARIO_IDS = [
  'connect-first-visit',
  'connect-browser-not-supported',
  'connect-connecting',
  'connect-wrong-folder',
  'connect-connected-first-time',
  'connect-open-files-coming-next',
  'models-20',
  'models-gaps',
  'models-none',
  'models-full',
  'models-full-explained',
  'models-copy',
  'models-copy-name-too-long',
  'models-copy-saved',
  'models-move',
  'models-moved',
  'models-dragged',
  'models-edit-coming-next',
  'models-add-coming-next',
  'models-radio-setup',
  'delete-confirm',
  'delete-current-model',
  'delete-current-model-not-picked',
  'delete-current-model-picked',
  'delete-done',
  'delete-restored',
  'delete-restored-elsewhere',
  'finish-and-unplug',
  'finish-disconnected',
] as const

export type ScenarioId = (typeof SCENARIO_IDS)[number]

export interface Scenario {
  id: ScenarioId
  group: ScenarioGroup
  /** The page the scenario opens on. */
  path: string
  state: AppState
}

const after = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state)

const notConnected = initialState(true)

const justConnected = (models: readonly Model[], currentModelId: ModelId | null): AppState =>
  after(notConnected, { type: 'connectSucceeded', models, currentModelId })

const ready = (
  models: readonly Model[] = SAMPLE_MODELS,
  currentModelId: ModelId | null = SAMPLE_CURRENT_MODEL_ID,
  baseFitting: BaseFitting = 'blankCover',
): AppState => after(justConnected(models, currentModelId), { type: 'baseFittingAnswered', baseFitting })

// Model ids from the sample data follow the position each model starts in: m03 is TRX-4,
// m08 is Slash 2WD, m11 is Micro B, m14 is MojaveGrom, and m20 (Mini 8ight) is the one the radio is set to.
const copyName = 'TRX-4 Snow'

const threeDeleted = after(
  ready(),
  { type: 'deleteConfirmed', modelId: 'm14' },
  { type: 'deleteConfirmed', modelId: 'm11' },
  { type: 'deleteConfirmed', modelId: 'm08' },
)

const details: Record<ScenarioId, Omit<Scenario, 'id'>> = {
  'connect-first-visit': { group: 'connect', path: paths.home, state: notConnected },
  'connect-browser-not-supported': { group: 'connect', path: paths.home, state: initialState(false) },
  'connect-connecting': { group: 'connect', path: paths.home, state: after(notConnected, { type: 'connectStarted' }) },
  // The simulated Connect always succeeds, so no click leads here. The state is set directly.
  'connect-wrong-folder': { group: 'connect', path: paths.home, state: { ...notConnected, connection: 'wrongFolder' } },
  'connect-connected-first-time': {
    group: 'connect',
    path: paths.home,
    state: justConnected(SAMPLE_MODELS, SAMPLE_CURRENT_MODEL_ID),
  },
  'connect-open-files-coming-next': { group: 'connect', path: paths.openFiles, state: notConnected },

  'models-20': { group: 'models', path: paths.home, state: ready() },
  // Three deletes leave positions 8, 11 and 14 empty, with models on both sides of each.
  'models-gaps': { group: 'models', path: paths.home, state: after(threeDeleted, { type: 'noticeDismissed' }) },
  'models-none': { group: 'models', path: paths.home, state: ready([], null) },
  'models-full': { group: 'models', path: paths.home, state: ready(FULL_RADIO_MODELS) },
  'models-full-explained': {
    group: 'models',
    path: paths.home,
    state: after(ready(FULL_RADIO_MODELS), { type: 'copyRequested', modelId: 'm03' }),
  },
  'models-copy': {
    group: 'models',
    path: paths.home,
    state: { ...ready(), dialog: { type: 'copy', modelId: 'm03', draftName: copyName } },
  },
  'models-copy-name-too-long': {
    group: 'models',
    path: paths.home,
    state: { ...ready(), dialog: { type: 'copy', modelId: 'm03', draftName: 'TRX-4 Snow Tires' } },
  },
  'models-copy-saved': {
    group: 'models',
    path: paths.home,
    state: after(ready(), { type: 'copyConfirmed', modelId: 'm03', name: copyName }),
  },
  'models-move': {
    group: 'models',
    path: paths.home,
    state: { ...ready(), dialog: { type: 'move', modelId: 'm03', toPosition: 7 } },
  },
  'models-moved': {
    group: 'models',
    path: paths.home,
    state: after(ready(), { type: 'modelMoved', modelId: 'm03', toPosition: 7 }),
  },
  // A drag ends in the same action as the Move dialog. Here Mini 8ight was dragged from 20 up to 2.
  'models-dragged': {
    group: 'models',
    path: paths.home,
    state: after(ready(), { type: 'modelMoved', modelId: SAMPLE_CURRENT_MODEL_ID, toPosition: 2 }),
  },
  'models-edit-coming-next': { group: 'models', path: paths.editModel('m03'), state: ready() },
  'models-add-coming-next': { group: 'models', path: paths.addModel, state: ready() },
  'models-radio-setup': {
    group: 'models',
    path: paths.radioSetup,
    state: ready(SAMPLE_MODELS, SAMPLE_CURRENT_MODEL_ID, 'twoSwitches'),
  },

  'delete-confirm': {
    group: 'delete',
    path: paths.home,
    state: after(ready(), { type: 'deleteRequested', modelId: 'm08' }),
  },
  'delete-current-model': {
    group: 'delete',
    path: paths.home,
    state: after(ready(), { type: 'deleteRequested', modelId: SAMPLE_CURRENT_MODEL_ID }),
  },
  'delete-current-model-not-picked': {
    group: 'delete',
    path: paths.home,
    state: after(
      ready(),
      { type: 'deleteRequested', modelId: SAMPLE_CURRENT_MODEL_ID },
      { type: 'deleteConfirmed', modelId: SAMPLE_CURRENT_MODEL_ID },
    ),
  },
  'delete-current-model-picked': {
    group: 'delete',
    path: paths.home,
    state: { ...ready(), dialog: { type: 'delete', modelId: SAMPLE_CURRENT_MODEL_ID, switchToId: 'm03' } },
  },
  'delete-done': { group: 'delete', path: paths.home, state: threeDeleted },
  'delete-restored': {
    group: 'delete',
    path: paths.home,
    state: after(threeDeleted, { type: 'restoreRequested', modelId: 'm11' }),
  },
  // Micro B's old place, 11, is taken by a copy before it is restored, so it goes to the next empty place.
  'delete-restored-elsewhere': {
    group: 'delete',
    path: paths.home,
    state: after(
      ready(),
      { type: 'deleteConfirmed', modelId: 'm11' },
      { type: 'copyConfirmed', modelId: 'm10', name: 'Slash 4x4b' },
      { type: 'restoreRequested', modelId: 'm11' },
    ),
  },

  'finish-and-unplug': { group: 'finish', path: paths.finish, state: ready() },
  'finish-disconnected': { group: 'finish', path: paths.home, state: after(ready(), { type: 'disconnected' }) },
}

export const SCENARIOS: readonly Scenario[] = SCENARIO_IDS.map((id) => ({ id, ...details[id] }))

export const findScenario = (id: string | null): Scenario | undefined =>
  SCENARIOS.find((scenario) => scenario.id === id)

/** The address that loads a scenario. The reviewer panel and the screenshot script both use it. */
export const scenarioHref = (scenario: Scenario): string => `?state=${scenario.id}${scenario.path}`
