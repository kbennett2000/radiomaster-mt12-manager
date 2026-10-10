// Every word the app shows, in one place, so it can be reviewed and changed here.
//
// Written for someone who has never set up a radio. These words must never appear:
// channel, mix, logical switch, special function, input, output, curve, expo, protocol, YAML, slot file.
// Say "receiver port", "receiver type" and "model" instead.

import { APP_NAME } from '../config/app.ts'
import type { BrandId, LightColour, ReceiverTypeId } from '../domain/catalog.ts'
import type { ExtraKind, ExtraProblem } from '../domain/extras.ts'
import type {
  CustomWorks,
  Direction,
  ExtraState,
  FeedbackKind,
  FeedbackSound,
  SwitchPosition,
} from '../domain/model.ts'
import type { WhenDeleting } from '../domain/positions.ts'
import type { BaseFitting, ControlId, ControlKind } from '../domain/radio.ts'
import type { ScenarioGroup, ScenarioId } from '../state/scenarios.ts'
import type { OfferedThrottleFeel, VehicleKind, WizardStepId } from '../state/wizard.ts'

const RADIO_NAME = 'MT12'

const list = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' })

/** "a", "a and b", "a, b and c". */
export const listOf = (items: readonly string[]): string => list.format(items)

const comingNextBody = 'This part of the app isn’t built yet.'

// Wording for step 3 of the wizard that depends on the kind of vehicle.
const hasWheels = (kind: VehicleKind | null): boolean => kind !== 'boat' && kind !== 'other'
const turnsWrongWay = (kind: VehicleKind | null): string => {
  if (kind === 'boat') return 'the boat turns the wrong way'
  return kind === 'other' ? 'it turns the wrong way' : 'the wheels turn the wrong way'
}
const goesBackwards = (kind: VehicleKind | null): string => {
  if (kind === 'boat') return 'the boat goes backwards'
  return kind === 'other' ? 'it goes backwards' : 'the vehicle goes backwards'
}

/** Where a switch is, as the end of a sentence: "when the switch is up". */
const switchIs: Record<SwitchPosition, string> = { up: 'up', middle: 'in the middle', down: 'down' }

// When a light colour shows, for an extra with a colour for each state: "blue light in low gear".
const lightIsOn: Record<Exclude<ExtraState, 'on'>, string> = {
  low: 'in low gear',
  high: 'in high gear',
  neutral: 'in neutral',
  up: 'when up',
  middle: 'in the middle',
  down: 'when down',
}

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
    gentleThrottle: 'Gentle throttle',
    customThrottleFeel: 'Custom throttle feel',
    feedback: (kinds: string) => `Radio feedback: ${kinds}`,
  },

  features: {
    steering: 'Steering',
    throttle: 'Throttle',
    twoSpeedTransmission: '2-speed transmission',
    frontDiffLock: 'Front diff lock',
    rearDiffLock: 'Rear diff lock',
    lights: 'Lights',
    cruiseControl: 'Cruise control',
    gyroGain: 'Gyro gain',
    dragBrake: 'Drag brake',
    throttleSafetyLock: 'Throttle safety lock',
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

  // Radio controls: the name printed on the radio, plus a short description of the kind of control.
  controls: {
    wheel: 'Steering wheel',
    trigger: 'Throttle trigger',
    SA: 'SA switch',
    SB: 'SB button',
    SC: 'SC button',
    SD: 'SD button',
    P1: 'P1 dial',
    P2: 'P2 dial',
    T1: 'T1 buttons',
    T2: 'T2 buttons',
    T3: 'T3 buttons',
    T4: 'T4 buttons',
    T5: 'T5 buttons',
    baseSwitchLeft: 'Left base switch',
    baseSwitchRight: 'Right base switch',
    joystickLeftRight: 'Joystick left and right',
    joystickUpDown: 'Joystick up and down',
  } satisfies Record<ControlId, string>,

  controlKinds: {
    wheel: 'steers',
    trigger: 'drives',
    switch3: 'three positions',
    switch2: 'two positions',
    pushButton: 'springs back',
    buttonPair: 'a pair, spring back',
    dial: 'turns',
  } satisfies Record<ControlKind, string>,

  // Receivers. Each one has the brand that makes it, what the label on it (or its box) says,
  // and the receiver type name the app shows for it.
  brands: {
    dumborc: 'DumboRC',
    radiolink: 'RadioLink',
    spektrum: 'Spektrum',
    traxxas: 'Traxxas',
    frsky: 'FrSky',
    flysky: 'Flysky',
    futaba: 'Futaba',
    kyosho: 'Kyosho',
    losi: 'Losi',
    axial: 'Axial',
    wltoys: 'WLtoys',
    wpl: 'WPL',
    kamtom: 'KAMTOM',
    eazyrc: 'EazyRC',
    jiabaile: 'JIABAILE',
  } satisfies Record<BrandId, string>,

  receiverLabels: {
    'dumborc-x': 'X6, X6F, X6FG, X6DC, X6DCG, X10F, X10FG',
    'dumborc-p': 'P6F, P6FG, P6DC, P6DCG, P6FP, P10F, P10FG',
    radiolink: 'R7FG, R6FG, R6F, R8EF, R8FM, R8F, R4FGM, R4F',
    'radiolink-r4eh': 'R4EH-G, R4EH-H',
    'spektrum-dsmr': 'DSMR receivers for cars and trucks',
    'spektrum-dsm2': 'DSM2 receivers for cars and trucks, such as SR3100',
    'spektrum-slt': 'SLT receivers: SPMXSE2825RX, SPMXSBER1025G, SPMXSE4510RX',
    'traxxas-tq': 'TQ 2.4GHz receivers 6519, 2218, 2218X, ECM-2.5',
    'traxxas-tq-2217': 'Receiver 2217',
    'frsky-d8': 'D4R, D8R',
    'frsky-d16': 'X4R, X6R, X8R',
    'flysky-afhds2a': 'AFHDS 2A receivers',
    'flysky-bs': 'FS-BS4, FS-BS6',
    'futaba-sfhss': 'S-FHSS receivers',
    'kyosho-fhss': 'Mini-Z FHSS (KT-531P), Syncro KR-331',
    'kyosho-asf': 'Mini-Z ASF',
    losi: 'Vehicles that came with the LSR-3000 transmitter',
    'axial-scx24': 'SCX24: Deadbolt, Jeep Wrangler Rubicon, Chevrolet C10, B-17 Betty',
    wltoys: 'Cars 284131, 284161, 284010, 124016, 124017, 144010',
    'wltoys-v8': 'Cars 284019A, 284191 (V8 transmitter)',
    wpl: 'D12, D12KM, D22, D32, D42, D14',
    kamtom: 'KM24xx, Pinecone SG-24xx',
    eazyrc: 'EazyRC cars',
    jiabaile: 'JBL-430x 1:43 cars',
  } satisfies Record<ReceiverTypeId, string>,

  receiverTypes: {
    'dumborc-x': 'DumboRC X-series',
    'dumborc-p': 'DumboRC P-series',
    radiolink: 'RadioLink',
    'radiolink-r4eh': 'RadioLink R4EH',
    'spektrum-dsmr': 'Spektrum DSMR',
    'spektrum-dsm2': 'Spektrum DSM2',
    'spektrum-slt': 'Spektrum SLT',
    'traxxas-tq': 'Traxxas TQ',
    'traxxas-tq-2217': 'Traxxas TQ (2217)',
    'frsky-d8': 'FrSky D8',
    'frsky-d16': 'FrSky D16',
    'flysky-afhds2a': 'Flysky AFHDS 2A',
    'flysky-bs': 'Flysky BS4/BS6',
    'futaba-sfhss': 'Futaba S-FHSS',
    'kyosho-fhss': 'Kyosho FHSS',
    'kyosho-asf': 'Kyosho ASF',
    losi: 'Losi',
    'axial-scx24': 'Axial SCX24',
    wltoys: 'WLtoys',
    'wltoys-v8': 'WLtoys V8',
    wpl: 'WPL',
    kamtom: 'KAMTOM',
    eazyrc: 'EazyRC',
    jiabaile: 'JIABAILE',
  } satisfies Record<ReceiverTypeId, string>,

  // The rules every model name follows, shared by Copy and by the "Add a model" wizard.
  modelName: {
    hint: (max: number) => `Up to ${max} characters.`,
    count: (used: number, max: number) => `${used} of ${max} characters`,
    tooLong: (used: number, max: number) =>
      `That name is ${used} characters long. Your radio allows ${max} at most.`,
    alreadyUsed: 'Another model already has that name. Choose a different one.',
  },

  copy: {
    title: (name: string) => `Copy ${name}`,
    nameLabel: 'Name for the copy',
    nameEmpty: 'Type a name for the copy.',
    confirm: 'Copy model',
    cancel: 'Cancel',
  },

  // The "Add a model" wizard. One question at a time, for someone who may never have set up a radio.
  addModel: {
    title: 'Add a model',
    goesIn: (position: number) => `It will go in position ${position}.`,
    stepsLabel: 'Steps',
    stepNames: {
      name: 'Name',
      receiver: 'Receiver',
      steeringThrottle: 'Steering and throttle',
      extras: 'Extras',
      feedback: 'Feedback',
      review: 'Review',
      bind: 'Bind your receiver',
    } satisfies Record<WizardStepId, string>,
    done: 'Done',
    back: 'Back',
    next: 'Next',
    cancel: 'Cancel',

    name: {
      question: 'What do you want to call it?',
      help: 'This is the name your radio shows on its screen.',
      empty: 'Type a name for your model.',
      kindQuestion: 'What kind of vehicle is it?',
      kindHelp: 'This only helps the app suggest settings. You can change everything later.',
      kindMissing: 'Choose the kind of vehicle to carry on.',
      kinds: {
        carOrTruck: 'Car or truck',
        crawler: 'Crawler or trail truck',
        boat: 'Boat',
        other: 'Something else',
      } satisfies Record<VehicleKind, string>,
    },

    receiver: {
      question: 'Which receiver is in your vehicle?',
      intro:
        'The receiver is the small box in your vehicle that listens to your radio. Look for the brand and model number printed on it.',
      searchLabel: 'Type the brand or the model number',
      listLabel: 'Receivers',
      // How many receivers the list holds right now. Most of them are below the edge of its frame.
      count: (shown: number, all: number) => {
        if (shown === all) return `${all} receivers. Scroll the list to see them all.`
        return shown === 1 ? '1 receiver matches.' : `${shown} receivers match.`
      },
      picked: (name: string) => `You picked ${name}.`,
      nothingMatches: (typed: string) =>
        `Nothing matches “${typed}”. Check the spelling, or try just the brand.`,
      missing: 'Choose your receiver from the list to carry on.',
      cantFind: 'I can’t find my receiver',
      cantFindTitle: 'More help is coming next',
      cantFindBody:
        'For now the app only knows the receivers in this list. More help with finding yours is coming next.',
      cantFindClose: 'Close',
    },

    steeringThrottle: {
      steering: 'Steering',
      throttle: 'Throttle',
      steeringDirection: 'Steering direction',
      // A boat has no wheels, and "something else" may not have any either.
      steeringDirectionHelp: (kind: VehicleKind | null) =>
        `You can’t test this until your radio is unplugged. If ${turnsWrongWay(kind)}, come back and switch it.`,
      throttleDirection: 'Throttle direction',
      throttleDirectionHelp: (kind: VehicleKind | null) =>
        `You can’t test this until your radio is unplugged. If ${goesBackwards(kind)} when you pull the trigger, come back and switch it.`,
      directions: { normal: 'Normal', reversed: 'Reversed' } satisfies Record<Direction, string>,
      travel: (kind: VehicleKind | null) => (hasWheels(kind) ? 'How far the wheels turn' : 'How far the steering turns'),
      travelHelp: 'Lower this if the steering strains at full lock.',
      feel: 'Throttle feel',
      feelHelp:
        'Gentle makes the first part of the trigger less sensitive. Good for crawling and slow driving.',
      feels: { standard: 'Standard', gentle: 'Gentle' } satisfies Record<OfferedThrottleFeel, string>,
      topSpeed: 'Top speed limit',
      topSpeedHelp: 'Lower this for a new driver.',
      percent: (value: number) => `${value}%`,
      moreOptions: 'More options',
      ports: 'Receiver ports',
      portsHelp: 'Almost every vehicle uses port 1 for steering and port 2 for throttle.',
      steeringPort: 'Steering port',
      throttlePort: 'Throttle port',
      port: (port: number) => `Port ${port}`,
      portTaken: (port: number, usedBy: string) => `Port ${port} · used by ${usedBy}`,
      samePort: (port: number) =>
        `Steering and throttle can’t both use port ${port}. Choose a different port for one of them.`,
    },

    extras: {
      question: 'What else does your vehicle have?',
      help: 'Pick anything your vehicle has. Skip this step if it only steers and drives.',
      commonOnCrawlers: 'Common on crawlers',
      // One plain sentence for each extra.
      about: {
        twoSpeedTransmission: 'Shifts between low gear and high gear.',
        frontDiffLock: 'Locks the front wheels together for more grip.',
        rearDiffLock: 'Locks the rear wheels together for more grip.',
        lights: 'Turns the vehicle’s lights on and off.',
        cruiseControl: 'Holds a steady speed so you can walk behind and just steer.',
        gyroGain: 'Sets how strongly a steering gyro corrects. Only if your receiver has a gyro.',
        dragBrake:
          'Sets how hard the vehicle brakes when you let go of the trigger. Only if your speed controller supports it.',
        throttleSafetyLock: 'The trigger does nothing until you unlock it.',
        hornSound: 'Your radio plays a horn when you press a button.',
        customExtra: 'Anything not listed, such as a winch or a mode switch. You name it.',
      } satisfies Record<ExtraKind, string>,
      somethingElse: 'Something else',
      addAnother: 'Add another “Something else”',

      nameLabel: 'What is it called?',
      nameHint: (max: number) => `Up to ${max} characters.`,
      nameCount: (used: number, max: number) => `${used} of ${max} characters`,
      worksQuestion: 'How does it work?',
      works: {
        onOff: { label: 'On and off', description: 'It is either on or off.' },
        threePositions: { label: 'Three positions', description: 'Such as a winch: in, stop and out.' },
        dial: { label: 'A dial', description: 'You set it to any amount.' },
      } satisfies Record<CustomWorks, { label: string; description: string }>,

      controlQuestion: 'Which control works it?',
      cruiseOnOffQuestion: 'Which control turns it on and off?',
      cruiseSpeedQuestion: 'Which dial sets the speed?',
      usedBy: (name: string) => `used by ${name}`,
      positionQuestion: 'Which position turns it on?',
      lockPositionQuestion: 'Which position unlocks the trigger?',
      positions: { up: 'Up', middle: 'Middle', down: 'Down' } satisfies Record<SwitchPosition, string>,
      swap: 'Swap high and low',

      portQuestion: 'Which receiver port is it plugged into?',
      port: (port: number) => `Port ${port}`,
      gyroHint: (port: number) => `This receiver uses port ${port} for gyro gain.`,

      // Said when nothing of the needed kind is left to pick.
      noControlFree:
        'Every control that could work this is already in use. To use one here, first take it off another extra.',
      noDialFree: 'Every dial is already in use. To use one here, first take it off another extra.',
      noPortFree:
        'Every receiver port from 3 to 8 is already in use. To free one, take it off another extra.',

      problems: {
        nameMissing: 'Type a name for it.',
        nameTooLong: (used: number, max: number) => `That name is ${used} characters long. It can be ${max} at most.`,
        worksMissing: 'Choose how it works.',
        controlMissing: 'Choose the control that works it.',
        speedControlMissing: 'Choose the dial that sets the speed.',
        portMissing: 'Choose the receiver port it is plugged into.',
      } satisfies Record<ExtraProblem, string | ((used: number, max: number) => string)>,

      done: 'Done',
      change: 'Change',
      changeNamed: (name: string) => `Change ${name}`,
      notFinished: 'Not finished yet.',
      // The folded-down line for an answered extra: its controls and, if it has one, its port.
      summaryPort: (port: number) => `port ${port}`,
    },

    // How a control works an extra, in one sentence. Review and step 4 both use these.
    how: {
      onOff: {
        pushButton: 'Press once to turn it on. Press again to turn it off.',
        buttonPair: 'One button turns it on. The other turns it off.',
        switch3: (on: SwitchPosition) =>
          `It is on when the switch is ${switchIs[on]}, and off in the other two positions.`,
        switch2: 'On in one position, off in the other.',
      },
      // For the throttle safety lock, "on" would be unclear: it could mean locked or unlocked.
      lock: {
        pushButton: 'Press once to unlock the trigger. Press again to lock it.',
        buttonPair: 'One button unlocks the trigger. The other locks it.',
        switch3: (on: SwitchPosition) =>
          `The trigger is unlocked when the switch is ${switchIs[on]}, and locked in the other two positions.`,
        switch2: 'The trigger is unlocked in one position and locked in the other.',
      },
      twoSpeed: {
        pushButton: 'Press to change between low and high gear.',
        buttonPair: 'One button picks high gear. The other picks low gear.',
        switch3: (swapped: boolean) =>
          swapped
            ? 'Up is low gear, middle is neutral, down is high gear.'
            : 'Up is high gear, middle is neutral, down is low gear.',
        switch2: 'One position is high gear. The other is low gear.',
      },
      threePositions: {
        switch3: 'Up, middle and down are its three positions.',
        buttonPair: 'Hold one button for one direction, the other for the opposite. Let go and it stops.',
      },
      dial: 'Turn the dial to set it.',
      horn: {
        pushButton: 'Press the button and your radio plays the horn.',
        buttonPair: 'Press either button and your radio plays the horn.',
      },
      cruiseOnOff: {
        pushButton: 'Press once to turn it on. Press again to turn it off.',
        switch2: 'On in one position, off in the other.',
      },
      cruiseSpeed: 'Turn the dial to set the speed.',
      steering: 'Turn the wheel to steer.',
      throttle: 'Pull the trigger to drive.',
      // Cruise control uses two controls, so each one says which part it does.
      cruiseOnOffPart: 'on and off',
      cruiseSpeedPart: 'speed',
    },

    feedback: {
      question: 'How should your radio tell you what’s happening?',
      help: 'Your radio can beep, speak, buzz and change the colour of its lights, so you don’t have to look down.',
      modelColour: 'Light colour for this model',
      modelColourHelp: 'Handy for telling at a glance which model your radio is set to.',
      dontChange: 'Don’t change',
      colours: {
        red: 'Red',
        orange: 'Orange',
        yellow: 'Yellow',
        green: 'Green',
        blue: 'Blue',
        purple: 'Purple',
        white: 'White',
      } satisfies Record<LightColour, string>,
      extrasTitle: 'When an extra switches',
      extrasHelp: 'Choose what your radio does each time one of these switches.',
      nothingSwitches:
        'Nothing you picked switches on and off, so the model’s light colour is the only thing to set here.',
      sound: 'Sound',
      sounds: { off: 'Off', beep: 'Beep', voice: 'Voice' } satisfies Record<FeedbackSound, string>,
      vibration: 'Vibration',
      vibrationOff: 'Off',
      vibrationOn: 'On',
      // One colour for each state an extra can be in. Most extras are only on or off.
      colourFor: {
        on: 'Light colour while it is on',
        low: 'Light colour in low gear',
        high: 'Light colour in high gear',
        neutral: 'Light colour in neutral',
        up: 'Light colour when up',
        middle: 'Light colour in the middle',
        down: 'Light colour when down',
      } satisfies Record<ExtraState, string>,
      // Marks a colour most people will leave alone.
      optional: 'optional',
      none: 'None',
      // A setting named in full for screen readers, such as "Sound for Lights".
      settingFor: (setting: string, extra: string) => `${setting} for ${extra}`,
      says: (words: readonly string[]) => `It will say ${listOf(words.map((word) => `“${word}”`))}.`,
      clash: 'If two of these would set the light colour at once, the one lower in this list wins.',
      // What Voice would say as each extra switches. Placeholder words: the sound files that say
      // them are not made yet, and will have to be put on the radio's SD card.
      voice: {
        twoSpeedTransmission: ['High gear', 'Low gear'],
        twoSpeedWithNeutral: ['High gear', 'Neutral', 'Low gear'],
        frontDiffLock: ['Front diff locked', 'Front diff open'],
        rearDiffLock: ['Rear diff locked', 'Rear diff open'],
        lights: ['Lights on', 'Lights off'],
        cruiseControl: ['Cruise on', 'Cruise off'],
        throttleSafetyLock: ['Throttle unlocked', 'Throttle locked'],
        onOff: (name: string) => [`${name} on`, `${name} off`],
        threePositions: (name: string) => [`${name} up`, `${name} middle`, `${name} down`],
      },
    },

    // The last page of the wizard. This wording is a placeholder: it has not been checked on a
    // real radio yet.
    bind: {
      title: 'Last step: bind your receiver',
      intro: 'Binding introduces your radio and your receiver to each other. You do it once, on the radio itself.',
      added: (name: string, position: number) => `“${name}” is in your list now, in position ${position}.`,
      steps: (name: string) => [
        'Finish and unplug your radio.',
        `On the radio, press MDL and choose ${name}.`,
        'Put the receiver into bind mode. Its instructions say how; it is usually a small button you hold while switching the vehicle on.',
        'On the radio, open the model’s setup and choose Bind.',
      ],
      backToModels: 'Back to your models',
      finishAndUnplug: 'Finish and unplug',
    },

    review: {
      title: 'Check it over',
      rows: {
        name: 'Name',
        position: 'Position',
        receiver: 'Receiver',
        steering: 'Steering',
        throttle: 'Throttle',
      },
      change: 'Change',
      changeNamed: (what: string) => `Change ${what.toLowerCase()}`,
      direction: { normal: 'Normal direction', reversed: 'Reversed direction' } satisfies Record<Direction, string>,
      travel: (value: number, kind: VehicleKind | null) =>
        hasWheels(kind) ? `Wheels turn ${value}%` : `Steering turns ${value}%`,
      feel: { standard: 'Standard feel', gentle: 'Gentle feel' } satisfies Record<OfferedThrottleFeel, string>,
      topSpeed: (value: number) => `Top speed limit ${value}%`,
      extrasNone: 'None',
      extrasLabel: 'Extras',
      port: (port: number) => `Port ${port}`,
      controlsTitle: 'What each control does',
      controlsHelp: 'Every control on your radio, and what it does on this model.',
      notUsed: 'Not used',
      // "2-speed transmission. Up is high gear…" or, for cruise control, "Cruise control, speed. Turn the dial…"
      job: (name: string, how: string | null) => (how ? `${name}. ${how}` : `${name}.`),
      jobPart: (name: string, part: string) => `${name}, ${part}`,
      portsTitle: 'What to plug into your receiver',
      portsHelp: 'The ports are numbered on the receiver’s case.',
      nothing: 'Nothing',
      feedbackLabel: 'Radio feedback',
      feedbackNone: 'None',
      modelColour: (colour: string) => `Model light colour: ${colour}`,
      // One extra's feedback, such as "Lights: beep, vibration and blue light".
      extraFeedback: (extra: string, what: string) => `${extra}: ${what}`,
      feedbackSound: { beep: 'beep', voice: 'voice' } satisfies Record<Exclude<FeedbackSound, 'off'>, string>,
      feedbackVibration: 'vibration',
      // "blue light", or for an extra with a colour for each state, "blue light in low gear".
      feedbackColour: (colour: string, state: ExtraState) =>
        state === 'on' ? `${colour.toLowerCase()} light` : `${colour.toLowerCase()} light ${lightIsOn[state]}`,
      afterThis: 'After this, the last step shows you how to bind your receiver.',
      confirm: 'Add to my radio',
    },

    leave: {
      title: 'Leave without adding this model?',
      body: 'The answers you have given so far will be lost.',
      keepGoing: 'Keep going',
      leave: 'Leave',
    },
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
    added: (name: string, position: number) => `“${name}” was added in position ${position}.`,
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
      body: `${comingNextBody} For now you can add, copy, move and delete models.`,
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
      wizard: 'Add a model',
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
      'wizard-name-empty': 'Step 1: empty',
      'wizard-name-too-long': 'Step 1: a name that is too long',
      'wizard-receiver': 'Step 2: before searching',
      'wizard-receiver-search': 'Step 2: a search that matches',
      'wizard-receiver-no-match': 'Step 2: a search that matches nothing',
      'wizard-receiver-picked': 'Step 2: a receiver picked',
      'wizard-receiver-cant-find': 'Step 2: “I can’t find my receiver”',
      'wizard-steering-car': 'Step 3: for a car',
      'wizard-steering-crawler': 'Step 3: for a crawler',
      'wizard-steering-more-options': 'Step 3: More options open',
      'wizard-steering-boat': 'Step 3: for a boat',
      'wizard-extras-empty': 'Step 4: nothing picked',
      'wizard-extras-crawler': 'Step 4: a crawler, with the labels',
      'wizard-extras-one-open': 'Step 4: one extra open',
      'wizard-extras-several': 'Step 4: six extras picked',
      'wizard-extras-taken': 'Step 4: a taken control',
      'wizard-extras-missing': 'Step 4: a missing answer',
      'wizard-extras-winch': 'Step 4: “Something else” as a winch',
      'wizard-extras-gyro-hint': 'Step 4: gyro gain, with the port 8 hint',
      'wizard-extras-boat': 'Step 4: for a boat, with no diff locks',
      'wizard-feedback-none': 'Step 5: nothing that switches',
      'wizard-feedback-rows': 'Step 5: several rows',
      'wizard-feedback-voice': 'Step 5: Voice picked',
      'wizard-feedback-clash': 'Step 5: a colour clash explained',
      'wizard-feedback-gears-switch': 'Step 5: 2-speed on SA, three colours',
      'wizard-feedback-gears-button': 'Step 5: 2-speed on a push button, two colours',
      'wizard-feedback-three-positions': 'Step 5: a three-position extra, with colours',
      'wizard-review': 'Review: no extras',
      'wizard-review-crawler': 'Review: a full crawler',
      'wizard-leave': 'The leave question',
      'wizard-bind': 'Step 7: bind your receiver',
      'wizard-added': 'The list after adding',
      'finish-and-unplug': 'Before you unplug',
      'finish-disconnected': 'Disconnected',
    } satisfies Record<ScenarioId, string>,
  },
} as const
