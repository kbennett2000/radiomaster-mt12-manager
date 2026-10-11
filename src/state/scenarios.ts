// Every state a reviewer should be able to look at, each reachable with one click from the reviewer panel.
// The screenshot script reads the same list, so the saved pictures cover exactly these states.
// Where a real click path exists, the state is built by running the real actions through the reducer.

import { FULL_RADIO_MODELS } from '../sample/fullRadio.ts'
import { SAMPLE_CURRENT_MODEL_ID, SAMPLE_MODELS } from '../sample/sampleModels.ts'
import type { ExtraAnswers, ExtraKind } from '../domain/extras.ts'
import type { ExtraFeedback, Model, ModelId } from '../domain/model.ts'
import type { BaseFitting } from '../domain/radio.ts'
import type { NextSave } from '../review/nextSave.ts'
import { initialState, reducer, type Action, type AppState } from './appState.ts'
import type { CardStep } from './cardChanges.ts'
import type { EditPart } from './edit.ts'
import { paths } from './useHashRoute.ts'
import type { BuiltStepId, ModelDraft, WizardView } from './wizard.ts'

export type ScenarioGroup = 'connect' | 'realCard' | 'cardChanges' | 'models' | 'delete' | 'wizard' | 'edit' | 'finish'

export const SCENARIO_GROUPS: readonly ScenarioGroup[] = [
  'connect',
  'realCard',
  'cardChanges',
  'models',
  'delete',
  'wizard',
  'edit',
  'finish',
]

/**
 * The made-up cards a reviewer can open. Each is written into the browser's own private storage
 * and then read from there by the same code that reads a folder the person picked.
 * See src/review/reviewCards.ts.
 */
export type ReviewCard =
  | 'madeUp'
  | 'twentyModels'
  | 'emptyPlace'
  | 'unknownReceiver'
  | 'unreadableModel'
  | 'wrongChecksum'
  | 'noModelsFolder'
  | 'twoDeleted'
  | 'fullCard'

export const SCENARIO_IDS = [
  'connect-first-visit',
  'connect-browser-not-supported',
  'connect-connecting',
  'connect-wrong-folder',
  'connect-connected-first-time',
  'connect-open-files-coming-next',
  'card-made-up',
  'card-20-models',
  'card-empty-place',
  'card-unknown-receiver',
  'card-unreadable-model',
  'card-wrong-checksum',
  'card-no-models-folder',
  'card-connect-page',
  'change-copy-saved',
  'change-move-saved',
  'change-delete-closed-up',
  'change-delete-left-empty',
  'change-restored',
  'change-recently-deleted',
  'change-edit-page',
  'change-renamed',
  'change-name-refused',
  'change-saving',
  'change-not-allowed',
  'change-card-changed',
  'change-backup-failed',
  'change-did-not-finish',
  'change-refused',
  'change-full-card',
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
  'wizard-extras-boat',
  'wizard-feedback-none',
  'wizard-feedback-rows',
  'wizard-feedback-voice',
  'wizard-feedback-clash',
  'wizard-feedback-gears-switch',
  'wizard-feedback-gears-button',
  'wizard-feedback-three-positions',
  'wizard-review',
  'wizard-review-crawler',
  'wizard-leave',
  'wizard-bind',
  'wizard-added',
  'edit-micro-b',
  'edit-trx4',
  'edit-trx4-22',
  'edit-airboat',
  'edit-tarantula',
  'edit-mini-8ight',
  'edit-name',
  'edit-receiver',
  'edit-steering',
  'edit-extras',
  'edit-feedback',
  'edit-extras-held',
  'edit-receiver-changed',
  'edit-steering-custom',
  'edit-steering-custom-replaced',
  'edit-name-problem',
  'edit-leave',
  'edit-saved',
  'edit-saved-receiver',
  'edit-bind',
  'finish-and-unplug',
  'finish-disconnected',
] as const

export type ScenarioId = (typeof SCENARIO_IDS)[number]

export interface Scenario {
  id: ScenarioId
  group: ScenarioGroup
  /** The page the scenario opens on. */
  path: string
  /** The state the app starts in. */
  state: AppState
  /** A made-up card the app opens as soon as it starts, as if its folder had just been picked. */
  card?: ReviewCard
  /** What is done to that card once it is open, in order, by the same code a click runs. */
  steps?: readonly CardStep[]
  /** A way the first save to that card is made to go wrong. */
  nextSave?: NextSave
}

const after = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state)

const notConnected = initialState(true)

/** Before a real card is opened, with the question about the base already answered, so the card's list is what shows. */
const aboutToOpenCard = after(notConnected, { type: 'baseFittingAnswered', baseFitting: 'blankCover' })

const realCard = (card: ReviewCard): Omit<Scenario, 'id'> => ({
  group: 'realCard',
  path: paths.home,
  state: aboutToOpenCard,
  card,
})

/**
 * A change to a made-up card. The card is opened and the steps are saved to it for real, in the
 * browser's private storage, so the state a reviewer lands on is one the saving code produced.
 */
const cardChange = (
  steps: readonly CardStep[],
  rest: Partial<Pick<Scenario, 'card' | 'path' | 'state' | 'nextSave'>> = {},
): Omit<Scenario, 'id'> => ({
  group: 'cardChanges',
  path: paths.home,
  state: aboutToOpenCard,
  card: 'madeUp',
  steps,
  ...rest,
})

// On the made-up card, Pebble is in position 1, Gravel Cat in 2, Mudskipper in 3, position 4 is
// empty, and the radio is set to Tin Snail in position 5. A real card names a model by its place.
const pebble = 'place-1'
const aCopy: CardStep = { kind: 'copy', position: 2, name: 'Shingle' }

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

/** Sets what the radio does as one extra switches, the way step 5 does. */
const withFeedback = (state: AppState, kind: ExtraKind, feedback: ExtraFeedback): AppState => {
  const id = state.wizard?.draft.extras.find((extra) => extra.kind === kind)?.id
  return id ? reducer(state, { type: 'wizardExtraChanged', id, answers: { feedback } }) : state
}

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
const aBoat: Partial<ModelDraft> = { name: 'Jet Boat', vehicleKind: 'boat', receiverTypeId: 'flysky-afhds2a' }

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

const fullCrawler = folded(withExtras(onExtras, ...crawlerExtras, ['hornSound', { control: 'SD' }], aWinch))
const fullCrawlerAdded = after(fullCrawler, { type: 'wizardStepShown', step: 'review' }, { type: 'wizardFinished' })

/** The page for one part of a model, opened the way "Change" opens it, and then whatever is done on it. */
const partOpen = (modelId: ModelId, part: EditPart, ...actions: Action[]): AppState =>
  after(ready(), { type: 'editOpened', modelId, part }, ...actions)

/** Picks an extra on a model's Extras page and answers its questions. It is left open. */
const withExtraAdded = (state: AppState, [kind, answers = {}]: PickedExtra): AppState => {
  const picked = reducer(state, { type: 'editExtraPicked', kind })
  const id = picked.edit?.view.openExtraId
  return id ? reducer(picked, { type: 'editExtraChanged', id, answers }) : picked
}

/** One scenario on a model's Edit page. */
const editPage = (modelId: ModelId, state: AppState = ready()): Omit<Scenario, 'id'> => ({
  group: 'edit',
  path: paths.editModel(modelId),
  state,
})

/** One scenario on the page for one part of a model. */
const partPage = (modelId: ModelId, part: EditPart, state = partOpen(modelId, part)): Omit<Scenario, 'id'> => ({
  group: 'edit',
  path: paths.editPart(modelId, part),
  state,
})

// TRX-4 with a different receiver picked, and then saved.
const receiverPicked = partOpen('m03', 'receiver', { type: 'editChanged', draft: { receiverTypeId: 'spektrum-dsm2' } })
const receiverSaved = after(receiverPicked, { type: 'editSaved' })

const details: Record<ScenarioId, Omit<Scenario, 'id'>> = {
  'connect-first-visit': { group: 'connect', path: paths.home, state: notConnected },
  'connect-browser-not-supported': { group: 'connect', path: paths.home, state: initialState(false) },
  'connect-connecting': { group: 'connect', path: paths.home, state: after(notConnected, { type: 'connectStarted' }) },
  'connect-wrong-folder': { group: 'connect', path: paths.home, state: after(notConnected, { type: 'wrongFolderPicked' }) },
  'connect-connected-first-time': {
    group: 'connect',
    path: paths.home,
    state: justConnected(SAMPLE_MODELS, SAMPLE_CURRENT_MODEL_ID),
  },
  'connect-open-files-coming-next': { group: 'connect', path: paths.openFiles, state: notConnected },

  'card-made-up': realCard('madeUp'),
  'card-20-models': realCard('twentyModels'),
  'card-empty-place': realCard('emptyPlace'),
  'card-unknown-receiver': realCard('unknownReceiver'),
  'card-unreadable-model': realCard('unreadableModel'),
  'card-wrong-checksum': realCard('wrongChecksum'),
  'card-no-models-folder': realCard('noModelsFolder'),
  'card-connect-page': { group: 'realCard', path: paths.home, state: notConnected },

  'change-copy-saved': cardChange([aCopy]),
  // The radio's model is one of those that moves, so the strip and the settings follow it.
  'change-move-saved': cardChange([{ kind: 'move', from: 3, to: 5 }]),
  'change-delete-closed-up': cardChange([{ kind: 'delete', position: 2 }]),
  'change-delete-left-empty': cardChange([{ kind: 'delete', position: 2 }], {
    state: { ...aboutToOpenCard, whenDeleting: 'leaveEmpty' },
  }),
  'change-restored': cardChange([{ kind: 'delete', position: 2 }, { kind: 'restoreNewest' }]),
  'change-recently-deleted': cardChange([], { card: 'twoDeleted' }),
  'change-edit-page': cardChange([], { path: paths.editModel(pebble) }),
  'change-renamed': cardChange([{ kind: 'rename', position: 1, name: 'Boulder' }], { path: paths.editModel(pebble) }),
  // A name with a character the radio's file cannot keep, typed and then "Save changes" pressed.
  'change-name-refused': cardChange(
    [
      { kind: 'show', action: { type: 'cardEditOpened', position: 1 } },
      { kind: 'show', action: { type: 'cardEditChanged', name: 'Café' } },
      { kind: 'show', action: { type: 'cardEditTried' } },
    ],
    { path: paths.editPart(pebble, 'name') },
  ),
  'change-saving': cardChange([aCopy], { nextSave: 'neverEnds' }),
  'change-not-allowed': cardChange([aCopy], { nextSave: 'notAllowed' }),
  'change-card-changed': cardChange([aCopy], { nextSave: 'cardChanged' }),
  'change-backup-failed': cardChange([aCopy], { nextSave: 'backupFailed' }),
  // A move is several changes, so it can stop with some of them made.
  'change-did-not-finish': cardChange([{ kind: 'move', from: 3, to: 5 }], { nextSave: 'stopsPartWay' }),
  // The settings file has a wrong check number, and moving the radio's model would have to change that file.
  'change-refused': cardChange([{ kind: 'move', from: 5, to: 1 }], { card: 'wrongChecksum' }),
  'change-full-card': cardChange([], { card: 'fullCard' }),

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
  'wizard-steering-boat': wizardScenario('steeringThrottle', aBoat),
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
  // A boat has no diffs to lock, so the list is two lines shorter.
  'wizard-extras-boat': wizardScenario('extras', aBoat),
  // A car with only gyro gain, which is a dial and so does not switch.
  'wizard-feedback-none': wizardState('feedback', folded(withExtras(wizardOn('extras', aCar), ['gyroGain', { control: 'P1' }]))),
  'wizard-feedback-rows': wizardState('feedback', folded(withExtras(onExtras, ...crawlerExtras))),
  'wizard-feedback-voice': wizardState(
    'feedback',
    after(
      folded(withExtras(onExtras, ...crawlerExtras)),
      { type: 'wizardChanged', draft: { lightColour: 'green' } },
      { type: 'wizardExtraChanged', id: 'frontDiffLock', answers: { feedback: { sound: 'voice', vibration: true, lightColour: null } } },
      { type: 'wizardExtraChanged', id: 'lights', answers: { feedback: { sound: 'beep', vibration: false, lightColour: null } } },
    ),
  ),
  'wizard-feedback-clash': wizardState(
    'feedback',
    after(
      folded(withExtras(onExtras, ...crawlerExtras)),
      { type: 'wizardExtraChanged', id: 'frontDiffLock', answers: { feedback: { sound: 'beep', vibration: false, lightColour: 'orange' } } },
      { type: 'wizardExtraChanged', id: 'rearDiffLock', answers: { feedback: { sound: 'beep', vibration: false, lightColour: 'red' } } },
    ),
  ),
  // On the SA switch the gearbox has a neutral in the middle, so it has three colours. The front
  // diff lock has one too, which brings up the line about which row wins.
  'wizard-feedback-gears-switch': wizardState(
    'feedback',
    withFeedback(
      withFeedback(folded(withExtras(onExtras, ...crawlerExtras)), 'twoSpeedTransmission', {
        sound: 'voice',
        vibration: false,
        lightColour: null,
        stateColours: { low: 'blue', high: 'green', neutral: 'white' },
      }),
      'frontDiffLock',
      { sound: 'beep', vibration: false, lightColour: 'orange' },
    ),
  ),
  // A push button only changes between the two gears, so there is no neutral to colour.
  'wizard-feedback-gears-button': wizardState(
    'feedback',
    withFeedback(
      folded(withExtras(onExtras, ['twoSpeedTransmission', { control: 'SB' }], ['lights', { control: 'SC' }])),
      'twoSpeedTransmission',
      { sound: 'beep', vibration: true, lightColour: null, stateColours: { low: 'blue', high: 'green' } },
    ),
  ),
  'wizard-feedback-three-positions': wizardState(
    'feedback',
    withFeedback(folded(withExtras(onExtras, ['lights', { control: 'SB' }], aWinch)), 'customExtra', {
      sound: 'voice',
      vibration: false,
      lightColour: null,
      stateColours: { up: 'red', middle: 'white', down: 'blue' },
    }),
  ),
  'wizard-review': wizardScenario('review', withReceiver),
  // The gearbox and the winch each have a colour for more than one state, which Review spells out.
  'wizard-review-crawler': wizardState(
    'review',
    withFeedback(
      withFeedback(
        after(
          fullCrawler,
          { type: 'wizardChanged', draft: { lightColour: 'green' } },
          { type: 'wizardExtraChanged', id: 'frontDiffLock', answers: { feedback: { sound: 'voice', vibration: true, lightColour: null } } },
        ),
        'twoSpeedTransmission',
        { sound: 'voice', vibration: false, lightColour: null, stateColours: { low: 'blue', high: 'green' } },
      ),
      'customExtra',
      { sound: 'beep', vibration: false, lightColour: null, stateColours: { up: 'red', down: 'blue' } },
    ),
  ),
  // The address has moved off the wizard while it is open, which is what every way of leaving does.
  'wizard-leave': { group: 'wizard', path: paths.home, state: wizardOn('receiver', withReceiver) },
  // The same full crawler, just added. The wizard's last page shows first, then the list.
  'wizard-bind': { group: 'wizard', path: paths.bind, state: fullCrawlerAdded },
  'wizard-added': { group: 'wizard', path: paths.home, state: fullCrawlerAdded },

  // Six sample models that between them have everything the Edit page can show. m11 is Micro B,
  // m03 TRX-4, m06 TRX-4 2-2, m18 Airboat, m09 Tarantula, and m20 Mini 8ight, which the radio is set to.
  'edit-micro-b': editPage('m11'),
  'edit-trx4': editPage('m03'),
  'edit-trx4-22': editPage('m06'),
  'edit-airboat': editPage('m18'),
  'edit-tarantula': editPage('m09'),
  'edit-mini-8ight': editPage('m20'),
  'edit-name': partPage('m03', 'name'),
  'edit-receiver': partPage('m03', 'receiver'),
  'edit-steering': partPage('m03', 'steeringThrottle'),
  'edit-extras': partPage('m03', 'extras'),
  'edit-feedback': partPage('m03', 'feedback'),
  // Lights is being added to TRX-4 2-2. Its SD button is used by a preset made on the radio.
  'edit-extras-held': partPage('m06', 'extras', withExtraAdded(partOpen('m06', 'extras'), ['lights'])),
  'edit-receiver-changed': partPage('m03', 'receiver', receiverPicked),
  // Tarantula has a throttle feel that was made on the radio.
  'edit-steering-custom': partPage('m09', 'steeringThrottle'),
  'edit-steering-custom-replaced': partPage(
    'm09',
    'steeringThrottle',
    partOpen('m09', 'steeringThrottle', { type: 'editChanged', draft: { throttleFeel: 'standard' } }),
  ),
  // Summit is another model's name.
  'edit-name-problem': partPage('m03', 'name', partOpen('m03', 'name', { type: 'editChanged', draft: { name: 'Summit' } })),
  // The address has moved off the page while a change is not yet saved, which is what every way of leaving does.
  'edit-leave': editPage('m03', partOpen('m03', 'name', { type: 'editChanged', draft: { name: 'TRX-4 Mud' } })),
  // Horn sound was taken off TRX-4 and a winch was added, then saved.
  'edit-saved': editPage(
    'm03',
    after(
      withExtraAdded(after(partOpen('m03', 'extras'), { type: 'editExtraRemoved', id: 'hornSound' }), aWinch),
      { type: 'editSaved' },
    ),
  ),
  'edit-saved-receiver': editPage('m03', receiverSaved),
  'edit-bind': { group: 'edit', path: paths.rebind('m03'), state: receiverSaved },

  'finish-and-unplug': { group: 'finish', path: paths.finish, state: ready() },
  'finish-disconnected': { group: 'finish', path: paths.home, state: after(ready(), { type: 'disconnected' }) },
}

export const SCENARIOS: readonly Scenario[] = SCENARIO_IDS.map((id) => ({ id, ...details[id] }))

export const findScenario = (id: string | null): Scenario | undefined =>
  SCENARIOS.find((scenario) => scenario.id === id)

/** The address that loads a scenario. The reviewer panel and the screenshot script both use it. */
export const scenarioHref = (scenario: Scenario): string => `?state=${scenario.id}${scenario.path}`
