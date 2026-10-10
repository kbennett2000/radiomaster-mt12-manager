// Every state a reviewer should be able to look at, each reachable with one click from the reviewer panel.
// The screenshot script reads the same list, so the saved pictures cover exactly these states.
// Where a real click path exists, the state is built by running the real actions through the reducer.

import { FULL_RADIO_MODELS } from '../sample/fullRadio.ts'
import { SAMPLE_CURRENT_MODEL_ID, SAMPLE_MODELS } from '../sample/sampleModels.ts'
import type { ExtraAnswers, ExtraKind } from '../domain/extras.ts'
import type { Model, ModelId } from '../domain/model.ts'
import type { BaseFitting } from '../domain/radio.ts'
import { initialState, reducer, type Action, type AppState } from './appState.ts'
import { paths } from './useHashRoute.ts'
import type { BuiltStepId, ModelDraft, WizardView } from './wizard.ts'

export type ScenarioGroup = 'connect' | 'models' | 'delete' | 'wizard' | 'finish'

export const SCENARIO_GROUPS: readonly ScenarioGroup[] = ['connect', 'models', 'delete', 'wizard', 'finish']

export const SCENARIO_IDS = [
  'connect-first-visit',
  'connect-browser-not-supported',
  'connect-connecting',
  'connect-wrong-folder',
  'connect-connected-first-time',
  'connect-open-files-coming-next',
  'models-20',
  'models-gaps',
  'models-closed-up',
  'models-move-empty',
  'models-empty-moved',
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
  'models-radio-setup',
  'delete-confirm',
  'delete-confirm-leave-empty',
  'delete-current-model',
  'delete-current-model-not-picked',
  'delete-current-model-picked',
  'delete-done',
  'delete-done-left-empty',
  'delete-restored',
  'delete-restored-empty-place',
  'wizard-name-empty',
  'wizard-name-too-long',
  'wizard-receiver',
  'wizard-receiver-search',
  'wizard-receiver-no-match',
  'wizard-receiver-picked',
  'wizard-receiver-cant-find',
  'wizard-steering-car',
  'wizard-steering-crawler',
  'wizard-steering-more-options',
  'wizard-steering-boat',
  'wizard-extras-empty',
  'wizard-extras-crawler',
  'wizard-extras-one-open',
  'wizard-extras-several',
  'wizard-extras-taken',
  'wizard-extras-missing',
  'wizard-extras-winch',
  'wizard-extras-gyro-hint',
  'wizard-review',
  'wizard-review-crawler',
  'wizard-leave',
  'wizard-added',
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

// Three deletes with the list closing up after each one, which is what happens by default.
const threeDeleted = after(
  ready(),
  { type: 'deleteConfirmed', modelId: 'm14' },
  { type: 'deleteConfirmed', modelId: 'm11' },
  { type: 'deleteConfirmed', modelId: 'm08' },
)

/** The same radio with "Leave its place empty" chosen in Radio setup. */
const leavingPlacesEmpty: AppState = { ...ready(), whenDeleting: 'leaveEmpty' }

// A radio that arrived with empty places already in its list: positions 8, 11 and 14 hold nothing.
const arrivedWithGaps = ready(SAMPLE_MODELS.filter((model) => ![8, 11, 14].includes(model.position)))

/** The wizard, opened from "Add a model", on a step, with some answers already given. */
const wizardOn = (
  step: BuiltStepId,
  draft: Partial<ModelDraft> = {},
  view: Partial<WizardView> = {},
  radio: AppState = ready(),
): AppState =>
  after(radio, { type: 'wizardOpened' }, { type: 'wizardChanged', draft, view }, { type: 'wizardStepShown', step })

/** One extra to pick on step 4, with the answers to give it. Its receiver port is left to the suggestion. */
type PickedExtra = [kind: ExtraKind, answers?: Partial<ExtraAnswers>]

/** Picks extras and answers their questions, the way a person would. The last one picked is left open. */
const withExtras = (state: AppState, ...extras: PickedExtra[]): AppState =>
  extras.reduce((soFar, [kind, answers = {}]) => {
    const picked = reducer(soFar, { type: 'wizardExtraPicked', kind })
    const id = picked.wizard?.view.openExtraId
    return id ? reducer(picked, { type: 'wizardExtraChanged', id, answers }) : picked
  }, state)

/** Folds every extra down to its summary line. */
const folded = (state: AppState): AppState => reducer(state, { type: 'wizardChanged', view: { openExtraId: null } })

/** One wizard scenario on step 4 or later, from a state built with the helpers above. */
const wizardState = (step: BuiltStepId, state: AppState): Omit<Scenario, 'id'> => ({
  group: 'wizard',
  path: paths.addStep(step),
  state: after(state, { type: 'wizardStepShown', step }),
})

/** One wizard scenario: the page for a step, with the wizard already on that step. */
const wizardScenario = (
  step: BuiltStepId,
  draft: Partial<ModelDraft> = {},
  view: Partial<WizardView> = {},
): Omit<Scenario, 'id'> => ({ group: 'wizard', path: paths.addStep(step), state: wizardOn(step, draft, view) })

// Answers for a crawler called Bouncer, as far as each step needs them.
const named: Partial<ModelDraft> = { name: 'Bouncer', vehicleKind: 'crawler' }
const withReceiver: Partial<ModelDraft> = { ...named, receiverTypeId: 'dumborc-x' }
const aCar: Partial<ModelDraft> = { name: 'Rally', vehicleKind: 'carOrTruck', receiverTypeId: 'spektrum-dsmr' }

// What a typical crawler has. Each takes the receiver port it is suggested: 3, 4, 5, 6, and 8 for gyro gain.
const crawlerExtras: PickedExtra[] = [
  ['twoSpeedTransmission', { control: 'SA' }],
  ['frontDiffLock', { control: 'T3' }],
  ['rearDiffLock', { control: 'T2' }],
  ['lights', { control: 'SB' }],
  ['cruiseControl', { control: 'SC', speedControl: 'P1' }],
  ['gyroGain', { control: 'P2' }],
]
const aWinch: PickedExtra = ['customExtra', { name: 'Winch', works: 'threePositions', control: 'T5' }]
const onExtras = wizardOn('extras', withReceiver)

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
  'models-gaps': { group: 'models', path: paths.home, state: arrivedWithGaps },
  'models-closed-up': {
    group: 'models',
    path: paths.home,
    state: after(arrivedWithGaps, { type: 'emptyPlacesClosedUp' }),
  },
  'models-move-empty': {
    group: 'models',
    path: paths.home,
    state: { ...arrivedWithGaps, dialog: { type: 'move', fromPosition: 8, toPosition: 10 } },
  },
  'models-empty-moved': {
    group: 'models',
    path: paths.home,
    state: after(arrivedWithGaps, { type: 'placeMoved', fromPosition: 8, toPosition: 10 }),
  },
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
    state: { ...ready(), dialog: { type: 'move', fromPosition: 3, toPosition: 7 } },
  },
  'models-moved': {
    group: 'models',
    path: paths.home,
    state: after(ready(), { type: 'placeMoved', fromPosition: 3, toPosition: 7 }),
  },
  // A drag ends in the same action as the Move dialog. Here Mini 8ight was dragged from 20 up to 2.
  'models-dragged': {
    group: 'models',
    path: paths.home,
    state: after(ready(), { type: 'placeMoved', fromPosition: 20, toPosition: 2 }),
  },
  'models-edit-coming-next': { group: 'models', path: paths.editModel('m03'), state: ready() },
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
  'delete-confirm-leave-empty': {
    group: 'delete',
    path: paths.home,
    state: after(leavingPlacesEmpty, { type: 'deleteRequested', modelId: 'm08' }),
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
  'delete-done-left-empty': {
    group: 'delete',
    path: paths.home,
    state: after(leavingPlacesEmpty, { type: 'deleteConfirmed', modelId: 'm08' }),
  },
  // Micro B was deleted from position 11 and the list closed up, so bringing it back pushes models down.
  'delete-restored': {
    group: 'delete',
    path: paths.home,
    state: after(threeDeleted, { type: 'restoreRequested', modelId: 'm11' }),
  },
  'delete-restored-empty-place': {
    group: 'delete',
    path: paths.home,
    state: after(
      leavingPlacesEmpty,
      { type: 'deleteConfirmed', modelId: 'm11' },
      { type: 'restoreRequested', modelId: 'm11' },
    ),
  },

  'wizard-name-empty': wizardScenario('name'),
  'wizard-name-too-long': wizardScenario('name', { name: 'Rock Bouncer' }),
  'wizard-receiver': wizardScenario('receiver', named),
  'wizard-receiver-search': wizardScenario('receiver', named, { search: 'spek' }),
  'wizard-receiver-no-match': wizardScenario('receiver', named, { search: 'tamiya' }),
  'wizard-receiver-picked': wizardScenario('receiver', withReceiver),
  'wizard-receiver-cant-find': wizardScenario('receiver', named, { cantFindOpen: true }),
  'wizard-steering-car': wizardScenario('steeringThrottle', aCar),
  'wizard-steering-crawler': wizardScenario('steeringThrottle', withReceiver),
  'wizard-steering-more-options': wizardScenario('steeringThrottle', withReceiver, { moreOptionsOpen: true }),
  'wizard-steering-boat': wizardScenario('steeringThrottle', {
    name: 'Jet Boat',
    vehicleKind: 'boat',
    receiverTypeId: 'flysky-afhds2a',
  }),
  'wizard-extras-empty': wizardScenario('extras', aCar),
  'wizard-extras-crawler': wizardScenario('extras', withReceiver),
  'wizard-extras-one-open': wizardState('extras', withExtras(onExtras, ['lights'])),
  'wizard-extras-several': wizardState('extras', folded(withExtras(onExtras, ...crawlerExtras))),
  // A radio with two switches on its base. Three controls are in use, and the front diff lock is asking for one.
  'wizard-extras-taken': wizardState(
    'extras',
    withExtras(
      wizardOn('extras', withReceiver, {}, ready(SAMPLE_MODELS, SAMPLE_CURRENT_MODEL_ID, 'twoSwitches')),
      ['twoSpeedTransmission', { control: 'SA' }],
      ['lights', { control: 'SB' }],
      ['cruiseControl', { control: 'SC', speedControl: 'P1' }],
      ['frontDiffLock'],
    ),
  ),
  // Lights has no control yet, and Next has been clicked.
  'wizard-extras-missing': wizardState(
    'extras',
    after(withExtras(onExtras, ['lights'], ['frontDiffLock', { control: 'T3' }]), {
      type: 'wizardStepTried',
      step: 'extras',
    }),
  ),
  'wizard-extras-winch': wizardState('extras', withExtras(onExtras, ['lights', { control: 'SB' }], aWinch)),
  'wizard-extras-gyro-hint': wizardState('extras', withExtras(onExtras, ['gyroGain'])),
  'wizard-review': wizardScenario('review', withReceiver),
  'wizard-review-crawler': wizardState(
    'review',
    folded(withExtras(onExtras, ...crawlerExtras, ['hornSound', { control: 'SD' }], aWinch)),
  ),
  // The address has moved off the wizard while it is open, which is what every way of leaving does.
  'wizard-leave': { group: 'wizard', path: paths.home, state: wizardOn('receiver', withReceiver) },
  'wizard-added': {
    group: 'wizard',
    path: paths.home,
    state: after(wizardOn('review', withReceiver), { type: 'wizardFinished' }),
  },

  'finish-and-unplug': { group: 'finish', path: paths.finish, state: ready() },
  'finish-disconnected': { group: 'finish', path: paths.home, state: after(ready(), { type: 'disconnected' }) },
}

export const SCENARIOS: readonly Scenario[] = SCENARIO_IDS.map((id) => ({ id, ...details[id] }))

export const findScenario = (id: string | null): Scenario | undefined =>
  SCENARIOS.find((scenario) => scenario.id === id)

/** The address that loads a scenario. The reviewer panel and the screenshot script both use it. */
export const scenarioHref = (scenario: Scenario): string => `?state=${scenario.id}${scenario.path}`
