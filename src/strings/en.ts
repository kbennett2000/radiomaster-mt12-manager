// Every word the app shows, in one place, so it can be reviewed and changed here.
//
// Written for someone who has never set up a radio. These words must never appear:
// channel, mix, logical switch, special function, input, output, curve, expo, protocol, YAML, slot file.
// Say "receiver port", "receiver type" and "model" instead.

import { APP_NAME } from '../config/app.ts'
import type { ReceiverTypeId } from '../domain/catalog.ts'
import type { FeedbackKind } from '../domain/model.ts'
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
  },

  connect: {
    title: 'Connect your radio',
    intro: `Plug your ${RADIO_NAME} into this computer and you can manage its models right here. Nothing is uploaded. Your models stay on your radio and your computer.`,
    stepNumber: (number: number) => `Step ${number}`,
    steps: [
      {
        title: 'Plug in a USB cable',
        body: 'Use the USB port under the cover, next to the SD card slot. Not the port on the base, which is only for charging.',
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
    help: 'Look at the bottom of your radio. Your answer tells the app which controls you have.',
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
  },

  models: {
    title: 'Your models',
    addModel: 'Add a model',
    currentBadge: 'Your radio is set to this model',
    receiverType: 'Receiver type',
    edit: 'Edit',
    copy: 'Copy',
    delete: 'Delete',
    editNamed: (name: string) => `Edit ${name}`,
    copyNamed: (name: string) => `Copy ${name}`,
    deleteNamed: (name: string) => `Delete ${name}`,
    empty: {
      title: 'No models yet',
      body: 'Your radio has no models on it. Add your first one to get started.',
    },
    fullBanner: (max: number) =>
      `Your radio is full. It holds ${max} models. To add or copy one, first delete a model you no longer need.`,
  },

  summary: {
    steering: 'steering',
    throttle: 'throttle',
    basicsOnly: (basics: string) => `${basics} only.`,
    basicsPlus: (basics: string, extras: string) => `${basics}, plus ${extras}.`,
    extrasOnly: (extras: string) => `${extras}.`,
    nothing: 'Nothing set up yet.',
    customThrottleFeel: 'custom throttle feel',
    feedback: (kinds: string) => `Radio feedback: ${kinds}.`,
  },

  features: {
    twoSpeedTransmission: '2-speed transmission',
    frontDiffLock: 'front diff lock',
    rearDiffLock: 'rear diff lock',
    lights: 'lights',
    cruiseControl: 'cruise control',
    gyroGain: 'gyro gain',
    dragBrake: 'drag brake',
    throttleArming: 'throttle arming switch',
    throttlePresets: 'throttle presets',
    hornSound: 'horn sound',
    oneButtonPreset: (name: string) => `one-button preset “${name}”`,
    customExtra: (name: string) => name,
  },

  feedback: {
    voiceCallouts: 'voice callouts',
    beeps: 'beeps',
    vibration: 'vibration',
    ledColour: 'LED colour changes',
  } satisfies Record<FeedbackKind, string>,

  // Radio controls: the name printed on the radio, plus a plain description.
  // No screen shows these yet. The edit screens in the next cycle will.
  controls: {
    wheel: 'steering wheel',
    trigger: 'throttle trigger',
    SA: 'SA switch',
    SB: 'SB switch',
    SC: 'SC switch',
    SD: 'SD switch',
    P1: 'P1 dial',
    P2: 'P2 dial',
    throttleTrim: 'throttle trim buttons',
    steeringTrim: 'steering trim buttons',
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

  radioFull: {
    title: 'Your radio is full',
    body: (max: number) =>
      `Your radio holds ${max} models and it has ${max} on it now. Delete a model you no longer need, then try again.`,
    ok: 'OK',
  },

  deleteModel: {
    title: (name: string) => `Delete ${name}?`,
    body: 'It will be removed from your radio. A copy is kept, so you can undo this.',
    currentIntro: 'Your radio is set to this model right now.',
    switchLabel: 'Which model should your radio switch to?',
    switchPlaceholder: 'Choose a model',
    switchMissing: 'Choose a model for your radio to switch to. Then you can delete this one.',
    confirm: 'Delete model',
    keep: 'Keep it',
  },

  notice: {
    savedTitle: 'Saved to your radio',
    copied: (name: string) => `“${name}” was added to your models.`,
    deleted: (name: string) => `“${name}” was deleted. A copy is kept under Recently deleted, at the bottom of this page.`,
    restored: (name: string) => `“${name}” is back in your models.`,
    safeToUnplug: 'It’s safe to unplug your radio when you’re done.',
    undo: 'Undo',
    dismiss: 'Dismiss',
    radioSetupTitle: 'Radio setup updated',
    radioSetupBody: 'The app now knows what is fitted on the base of your radio.',
  },

  recentlyDeleted: {
    title: 'Recently deleted',
    body: 'A copy of each model you delete is kept here, so you can bring it back.',
    restore: 'Restore',
    restoreNamed: (name: string) => `Restore ${name}`,
  },

  comingNext: {
    eyebrow: 'Coming next',
    edit: {
      title: (name: string) => `Editing ${name} is coming next`,
      body: `${comingNextBody} For now you can copy and delete models.`,
    },
    add: {
      title: 'Adding a model is coming next',
      body: `${comingNextBody} For now you can copy and delete models.`,
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
    } satisfies Record<ScenarioGroup, string>,
    scenarios: {
      'connect-first-visit': 'First visit',
      'connect-browser-not-supported': 'Browser not supported',
      'connect-connecting': 'Connecting',
      'connect-wrong-folder': 'Wrong folder picked',
      'connect-connected-first-time': 'Connected, first time: what is on the base?',
      'connect-open-files-coming-next': 'Open files instead (coming next)',
      'models-20': '20 models',
      'models-none': 'No models yet',
      'models-full': '60 of 60',
      'models-full-explained': '60 of 60: Add or Copy clicked',
      'models-copy': 'Copy: asking for a name',
      'models-copy-name-too-long': 'Copy: name too long',
      'models-copy-saved': 'Copy: saved',
      'models-edit-coming-next': 'Edit (coming next)',
      'models-add-coming-next': 'Add a model (coming next)',
      'models-radio-setup': 'Radio setup',
      'delete-confirm': 'Confirm delete',
      'delete-current-model': 'Delete the model the radio is set to',
      'delete-current-model-not-picked': 'Same, tried to continue without picking',
      'delete-current-model-picked': 'Same, with a model picked',
      'delete-done': 'After deleting: Undo and Recently deleted',
      'delete-restored': 'After Restore',
    } satisfies Record<ScenarioId, string>,
  },
} as const
