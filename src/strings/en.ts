// Every word the app shows, in one place, so it can be reviewed and changed here.
//
// Written for someone who has never set up a radio. These words must never appear:
// channel, mix, logical switch, special function, input, output, curve, expo, protocol, YAML, slot file.
// Say "receiver port", "receiver type" and "model" instead.

import { APP_NAME } from '../config/app.ts'
import type { ReceiverTypeId } from '../domain/catalog.ts'
import type { FeedbackKind } from '../domain/model.ts'
import type { WhenDeleting } from '../domain/positions.ts'
import type { BaseFitting, ControlId } from '../domain/radio.ts'
import type { ScenarioGroup, ScenarioId } from '../state/scenarios.ts'

const RADIO_NAME = 'MT12'

const list = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' })

/** "a", "a and b", "a, b and c". */
export const listOf = (items: readonly string[]): string => list.format(items)

const comingNextBody = 'This part of the app isn’t built yet.'

export const strings = {
  appName: APP_NAME,
  skipToContent: 'Skip to the main content',

  header: {
    connected: (count: number, max: number) => `Connected to your ${RADIO_NAME} · ${count} of ${max} models`,
    radioSetup: 'Radio setup',
    finishAndUnplug: 'Finish and unplug',
  },

  connect: {
    title: 'Connect your radio',
    intro: `Plug your ${RADIO_NAME} into this computer and you can manage its models right here. Nothing is uploaded. Your models stay on your radio and your computer.`,
    stepNumber: (number: number) => `Step ${number}`,
    steps: [
      {
        title: 'Plug in a USB cable',
        body: 'Use the USB port under the cover, next to the SD card slot. Not the charging port on the base.',
      },
      {
        title: 'Choose “USB Storage (SD)”',
        body: 'Your radio asks what the cable is for. Choose USB Storage (SD) on its screen.',
      },
      {
        title: 'Click Connect and pick your radio',
        body: 'Your browser shows a list of drives. Pick the one that is your radio.',
      },
    ],
    // The words on the radio's own screen, shown inside the drawing for step 2.
    radioMenuChoice: 'USB Storage (SD)',
    connectButton: 'Connect',
    openFilesLink: 'Open files instead',
    disconnected: 'Your radio is disconnected. Connect it again whenever you like.',
    connecting: {
      button: 'Connecting…',
      status: 'Waiting for you to pick your radio’s drive…',
    },
    wrongFolder: {
      title: 'No models were found there',
      body: 'The folder you picked doesn’t look like your radio. Your radio’s drive has folders called MODELS and RADIO in it. Pick the drive itself, not a folder inside it.',
      retry: 'Try again',
    },
    unsupported: {
      title: 'This browser can’t connect to your radio',
      why: 'To connect, a web page has to be allowed to open your radio’s drive. Only the Chrome and Edge browsers can do that, and only on a computer.',
      whatNow: 'You can open this page in Chrome or Edge and connect there. Or stay here and open your radio’s files yourself.',
    },
    connected: {
      title: `Connected to your ${RADIO_NAME}`,
      found: (count: number) => (count === 1 ? '1 model found.' : `${count} models found.`),
      oneQuestion: 'One quick question before you start.',
      continue: 'Continue',
    },
  },

  baseFitting: {
    question: 'What is fitted on the base of your radio?',
    help: 'Look at the top of the base your radio stands on. Your answer tells the app which controls you have.',
    changeLater: 'You can change this later in Radio setup.',
    chooseFirst: 'Choose one of the three to carry on.',
    options: {
      blankCover: { label: 'Blank cover', description: 'A plain cover with nothing on it.' },
      twoSwitches: { label: 'Two switches', description: 'A panel with two extra switches.' },
      joystick: { label: 'Joystick', description: 'A small thumb stick.' },
    } satisfies Record<BaseFitting, { label: string; description: string }>,
  },

  radioSetup: {
    title: 'Radio setup',
    save: 'Save',
    back: 'Back to your models',
    whenDeleting: {
      question: 'When you delete a model',
      help: 'This decides what happens to the models after it in your list.',
      options: {
        closeUp: {
          label: 'Close up the list',
          description: 'The models after it each move up one place.',
        },
        leaveEmpty: {
          label: 'Leave its place empty, the way the radio itself does',
          description: 'No other model moves.',
        },
      } satisfies Record<WhenDeleting, { label: string; description: string }>,
    },
  },

  // The steps for unplugging safely. This wording is a placeholder: it has not been checked on a
  // real radio yet, and it will be once the app writes to one.
  finish: {
    title: 'Before you unplug',
    steps: [
      'Eject your radio’s drive on this computer, the same way you eject a USB stick.',
      'Unplug the USB cable.',
      'Your radio reloads your models. Check the list on its screen.',
    ],
    done: 'I’ve unplugged it',
  },

  models: {
    title: 'Your models',
    reorderHint: 'To change the order, drag a row by its handle or use Move.',
    addModel: 'Add a model',
    columns: {
      position: 'Position',
      model: 'Model',
      receiverType: 'Receiver type',
    },
    dragHandle: (name: string) => `Drag to move ${name}`,
    dragEmptyHandle: (position: number) => `Drag to move the empty place in position ${position}`,
    closeUp: 'Close up empty places',
    currentStrip: (name: string, position: number) => `Your radio is set to ${name}, in position ${position}.`,
    showInList: 'Show it in the list',
    currentMark: 'Your radio is set to this',
    edit: 'Edit',
    copy: 'Copy',
    move: 'Move',
    delete: 'Delete',
    editNamed: (name: string) => `Edit ${name}`,
    copyNamed: (name: string) => `Copy ${name}`,
    moveNamed: (name: string) => `Move ${name}`,
    moveEmptyNamed: (position: number) => `Move the empty place in position ${position}`,
    deleteNamed: (name: string) => `Delete ${name}`,
    emptyPlace: 'Empty',
    addHere: 'Add a model here',
    addHereNamed: (position: number) => `Add a model in position ${position}`,
    emptyAfter: (first: number, last: number) =>
      first === last ? `Position ${first} is empty.` : `Positions ${first} to ${last} are empty.`,
    empty: {
      title: 'No models yet',
      body: 'Your radio has no models on it. Add your first one to get started.',
    },
    fullBanner: (max: number) =>
      `Your radio is full. It holds ${max} models. To add or copy one, first delete a model you no longer need.`,
  },

  // What a model has, shown as short tags on its row. Steering and throttle are never tags,
  // because every model has them.
  tags: {
    noExtras: 'Steering and throttle only',
    customThrottleFeel: 'Custom throttle feel',
    feedback: (kinds: string) => `Radio feedback: ${kinds}`,
  },

  features: {
    twoSpeedTransmission: '2-speed transmission',
    frontDiffLock: 'Front diff lock',
    rearDiffLock: 'Rear diff lock',
    lights: 'Lights',
    cruiseControl: 'Cruise control',
    gyroGain: 'Gyro gain',
    dragBrake: 'Drag brake',
    throttleArming: 'Throttle arming switch',
    throttlePresets: 'Throttle presets',
    hornSound: 'Horn sound',
    oneButtonPreset: (name: string) => `One-button preset: ${name}`,
    customExtra: (name: string) => name,
  },

  feedback: {
    voiceCallouts: 'voice callouts',
    beeps: 'beeps',
    vibration: 'vibration',
    ledColour: 'LED colour changes',
  } satisfies Record<FeedbackKind, string>,

  // Radio controls: the name printed on the radio, plus a plain description.
  // No screen shows these yet. The edit screens will.
  controls: {
    wheel: 'steering wheel',
    trigger: 'throttle trigger',
    SA: 'SA switch',
    SB: 'SB switch',
    SC: 'SC switch',
    SD: 'SD switch',
    P1: 'P1 dial',
    P2: 'P2 dial',
    T1: 'T1 buttons',
    T2: 'T2 buttons',
    T3: 'T3 buttons',
    T4: 'T4 buttons',
    T5: 'T5 buttons',
  } satisfies Record<ControlId, string>,

  receiverTypes: {
    'spektrum-dsmr': 'Spektrum DSMR',
    'spektrum-slt': 'Spektrum SLT',
    'frsky-d8': 'FrSky D8',
    'dumborc-x': 'DumboRC X-series',
    'traxxas-tq': 'Traxxas TQ',
  } satisfies Record<ReceiverTypeId, string>,

  copy: {
    title: (name: string) => `Copy ${name}`,
    nameLabel: 'Name for the copy',
    nameHint: (max: number) => `Up to ${max} characters.`,
    count: (used: number, max: number) => `${used} of ${max} characters`,
    problems: {
      empty: 'Type a name for the copy.',
      tooLong: (used: number, max: number) =>
        `That name is ${used} characters long. Your radio allows ${max} at most.`,
      alreadyUsed: 'Another model already has that name. Choose a different one.',
    },
    confirm: 'Copy model',
    cancel: 'Cancel',
  },

  moveModel: {
    title: (name: string) => `Move ${name} to which position?`,
    titleEmpty: (position: number) => `Move the empty place in position ${position} to which position?`,
    positionLabel: 'Position',
    // One line of the list of positions to choose from.
    placeHolding: (position: number, name: string) => `${position} · ${name}`,
    placeEmpty: (position: number) => `${position} · Empty`,
    placeOwn: (position: number, name: string) => `${position} · ${name} (where it is now)`,
    placeOwnEmpty: (position: number) => `${position} · Empty (the place you are moving)`,
    // What is in the chosen position now.
    nowHolds: (position: number, name: string) => `${name} is in position ${position} now.`,
    nowEmpty: (position: number) => `Position ${position} is empty now.`,
    startEmpty: (position: number) => `Position ${position} is the empty place you are moving.`,
    alreadyThere: (name: string, position: number) =>
      `${name} is already in position ${position}. Choose a different position to move it.`,
    alreadyThereEmpty: (position: number) =>
      `This empty place is already in position ${position}. Choose a different position to move it.`,
    nothingWouldChange: (position: number) =>
      `Nothing would change. Position ${position} is empty too, and no model sits between the two places. Choose a different position.`,
    // What else shifts, in one sentence.
    nothingElseMoves: 'No other model moves.',
    oneOtherMoves: (name: string, from: number, to: number) =>
      `${name} moves from position ${from} to position ${to}.`,
    othersMove: (count: number, first: number, last: number, direction: 'up' | 'down') =>
      `The ${count} models in positions ${first} to ${last} each move ${direction} one place.`,
    confirm: 'Move model',
    confirmEmpty: 'Move empty place',
    cancel: 'Cancel',
  },

  radioFull: {
    title: 'Your radio is full',
    body: (max: number) =>
      `Your radio holds ${max} models and it has ${max} on it now. Delete a model you no longer need, then try again.`,
    ok: 'OK',
  },

  deleteModel: {
    title: (name: string) => `Delete ${name}?`,
    body: 'It will be removed from your radio. A copy is kept, so you can undo this.',
    // What happens to the rest of the list, said before the person confirms.
    othersWillMoveUp: (count: number) => `The ${count} models after it will each move up one place.`,
    oneWillMoveUp: (name: string) => `${name}, the model after it, will move up one place.`,
    lastInList: 'It is the last model in your list, so nothing else will move.',
    willLeaveEmpty: (position: number) => `Position ${position} will be left empty. Nothing else will move.`,
    currentIntro: 'Your radio is set to this model right now.',
    switchLabel: 'Which model should your radio switch to?',
    switchPlaceholder: 'Choose a model',
    switchMissing: 'Choose a model for your radio to switch to. Then you can delete this one.',
    confirm: 'Delete model',
    keep: 'Keep it',
  },

  notice: {
    savedTitle: 'Saved to your radio',
    copied: (name: string, position: number) => `“${name}” was added in position ${position}.`,
    deleted: (name: string) => `“${name}” was deleted.`,
    leftEmpty: (position: number) => `Position ${position} is now empty.`,
    copyKept: 'A copy is kept under Recently deleted, at the bottom of this page.',
    moved: (name: string, position: number) => `“${name}” moved to position ${position}.`,
    emptyMoved: (from: number, to: number) => `The empty place moved from position ${from} to position ${to}.`,
    closedUp: (count: number) =>
      count === 1
        ? 'The empty places were closed up. Your model is now in position 1.'
        : `The empty places were closed up. Your ${count} models are now in positions 1 to ${count}.`,
    restored: (name: string, position: number) => `“${name}” is back in position ${position}.`,
    undone: 'That change was undone. Your list is back the way it was.',
    // The other models that moved because of a change.
    othersAfterMovedUp: (count: number) => `The ${count} models after it each moved up one place.`,
    othersMoved: (count: number, first: number, last: number, direction: 'up' | 'down') =>
      `The ${count} models in positions ${first} to ${last} each moved ${direction} one place.`,
    oneMoved: (name: string, direction: 'up' | 'down') => `${name} moved ${direction} one place.`,
    undo: 'Undo',
    dismiss: 'Dismiss',
    radioSetupTitle: 'Radio setup updated',
    radioSetupBody: 'The app will use your new answers from now on.',
  },

  recentlyDeleted: {
    title: 'Recently deleted',
    body: 'A copy of each model you delete is kept here, so you can bring it back.',
    wasIn: (position: number) => `Was in position ${position}`,
    restore: 'Restore',
    restoreNamed: (name: string) => `Restore ${name}`,
  },

  comingNext: {
    eyebrow: 'Coming next',
    edit: {
      title: (name: string) => `Editing ${name} is coming next`,
      body: `${comingNextBody} For now you can copy, move and delete models.`,
    },
    add: {
      title: 'Adding a model is coming next',
      body: `${comingNextBody} For now you can copy, move and delete models.`,
    },
    openFiles: {
      title: 'Opening files yourself is coming next',
      body: `${comingNextBody} For now, click Connect to try the app with sample models.`,
    },
    backToModels: 'Back to your models',
    backToConnect: 'Back to Connect',
  },

  review: {
    tab: 'For reviewers only',
    about: 'This panel is not part of the app. Each link jumps straight to one state so you can look at it.',
    startOver: 'Start from the beginning',
    groups: {
      connect: 'Connect',
      models: 'Your models',
      delete: 'Delete',
      finish: 'Finish and unplug',
    } satisfies Record<ScenarioGroup, string>,
    scenarios: {
      'connect-first-visit': 'First visit',
      'connect-browser-not-supported': 'Browser not supported',
      'connect-connecting': 'Connecting',
      'connect-wrong-folder': 'Wrong folder picked',
      'connect-connected-first-time': 'Connected, first time: what is on the base?',
      'connect-open-files-coming-next': 'Open files instead (coming next)',
      'models-20': 'The list with 20 models',
      'models-gaps': 'The list with empty places, and “Close up empty places”',
      'models-closed-up': 'After closing up empty places',
      'models-move-empty': 'Move: an empty place',
      'models-empty-moved': 'After moving an empty place',
      'models-none': 'No models yet',
      'models-full': '60 of 60',
      'models-full-explained': '60 of 60: Add or Copy clicked',
      'models-copy': 'Copy: asking for a name',
      'models-copy-name-too-long': 'Copy: name too long',
      'models-copy-saved': 'Copy: saved',
      'models-move': 'Move: choosing a position',
      'models-moved': 'After a move',
      'models-dragged': 'After a drag',
      'models-edit-coming-next': 'Edit (coming next)',
      'models-add-coming-next': 'Add a model (coming next)',
      'models-radio-setup': 'Radio setup, with the delete question',
      'delete-confirm': 'Confirm delete: the list will close up',
      'delete-confirm-leave-empty': 'Confirm delete: its place will be left empty',
      'delete-current-model': 'Delete the model the radio is set to',
      'delete-current-model-not-picked': 'Same, tried to continue without picking',
      'delete-current-model-picked': 'Same, with a model picked',
      'delete-done': 'After deleting: the list closed up',
      'delete-done-left-empty': 'After deleting: its place was left empty',
      'delete-restored': 'After Restore: models pushed down',
      'delete-restored-empty-place': 'After Restore: its place was still empty',
      'finish-and-unplug': 'Before you unplug',
      'finish-disconnected': 'Disconnected',
    } satisfies Record<ScenarioId, string>,
  },
} as const
