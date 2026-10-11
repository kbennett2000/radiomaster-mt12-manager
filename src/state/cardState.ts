// What the app holds for a real card, and every way that can change.
//
// A real card is not held the way the sample models are. The app keeps the card's files exactly
// as it last read them from the folder or saved them to it, and works everything it shows out of
// those. A change is worked out from the files, saved to the folder, and only then shown: see
// cardChanges.ts for the working out and src/platform/saveToFolder.ts for the saving.

import { PLACES, readCard, type Card, type CardReading } from '../files/card.ts'
import type { CardProblem } from '../files/cardActions.ts'

/** Other models that changed place because of a change, so the confirmation can say so. */
export interface CardShift {
  count: number
  /** The positions the first and last of them were in before the change. */
  first: number
  last: number
  /** Which way they went: 'up' is toward position 1. */
  direction: 'up' | 'down'
  /** The model, when only one moved: its name, which is null when its file could not be read, and where it was. */
  only: { name: string | null; position: number } | null
}

/** One change that was saved to the card. A model's name is null when its file could not be read. */
export type CardChange =
  | { kind: 'copied'; modelName: string; position: number }
  | { kind: 'moved'; modelName: string | null; fromPosition: number; position: number }
  | { kind: 'emptyMoved'; fromPosition: number; position: number }
  | { kind: 'closedUp'; modelCount: number }
  /** `shift` is null when the model's place was left empty and nothing else moved. */
  | { kind: 'deleted'; modelName: string | null; position: number; shift: CardShift | null }
  | { kind: 'restored'; modelName: string | null; position: number; shift: CardShift }
  | { kind: 'renamed'; was: string; now: string; position: number }
  /** The change before this one was undone. `of` is that change. */
  | { kind: 'undone'; of: CardChange }

/** The confirmation of the last save. */
export interface CardNotice {
  change: CardChange
  /** The card's files as they were before the change, which Undo saves again. Null when there is nothing to undo. */
  undo: Card | null
  /** True when this save was the one that made the backup, so the notice can say where it is. */
  backupMade: boolean
}

/** Why the last thing asked for was not done. Whichever it is, the screen is left as it was. */
export type CardTrouble =
  /** The browser, or the person, said the app may not change the files. Nothing was changed. */
  | { kind: 'notAllowed' }
  /** Something else has changed the card since the app read it. Nothing was changed. */
  | { kind: 'cardChanged' }
  /** The backup could not be made. Nothing was changed. */
  | { kind: 'backupFailed' }
  /** Saving stopped part way, or what was written did not read back. The card has to be read again. */
  | { kind: 'didNotFinish' }
  /** The card logic would not do it. Nothing was asked of the folder. */
  | { kind: 'refused'; problem: CardProblem }

/** True for trouble that leaves the app not knowing what is on the card, so it must read it again. */
export const needsReadingAgain = (trouble: CardTrouble): boolean =>
  trouble.kind === 'cardChanged' || trouble.kind === 'didNotFinish'

export type CardDialog =
  | { type: 'copy'; position: number; draftName?: string }
  /** Moves whatever is in `fromPosition`: a model or an empty place. */
  | { type: 'move'; fromPosition: number; toPosition?: number }
  | { type: 'delete'; position: number; switchTo?: number; triedWithoutPicking?: boolean }

/** The name page for one model while it is open. Nothing is saved until "Save changes". */
export interface CardEdit {
  position: number
  name: string
  /** True once the person has tried to save. A missing name is only pointed out after that. */
  tried: boolean
}

export interface CardState {
  /** The card's files, as the app last read them from the folder or saved them to it. */
  files: Card
  /** What the app makes of those files. */
  reading: CardReading
  /** True while a save is running. Nothing else can be done until it ends. */
  saving: boolean
  /** True once a change has been saved since the card was read, so the browser has already said yes. */
  hasSaved: boolean
  notice: CardNotice | null
  trouble: CardTrouble | null
  dialog: CardDialog | null
  edit: CardEdit | null
}

/** The state for a card that has just been read. */
export const cardStateFor = (files: Card): CardState => ({
  files,
  reading: readCard(files),
  saving: false,
  hasSaved: false,
  notice: null,
  trouble: null,
  dialog: null,
  edit: null,
})

export type CardStateAction =
  | { type: 'cardCopyRequested'; position: number }
  /** `toPosition` is where a row was dropped, when the dialog is opened by a drop. */
  | { type: 'cardMoveRequested'; position: number; toPosition?: number }
  | { type: 'cardDeleteRequested'; position: number }
  /** The radio is set to the model being deleted, and no model was picked for it to switch to. */
  | { type: 'cardDeleteTriedWithoutPicking' }
  | { type: 'cardDialogClosed' }
  | { type: 'cardSaveStarted' }
  /** A save ended well. `files` is the card as it now is on the folder. */
  | { type: 'cardSaved'; files: Card; notice: CardNotice }
  /** A save was not made, or the card logic refused. Nothing on screen changes but the telling of it. */
  | { type: 'cardNotChanged'; trouble: CardTrouble }
  | { type: 'cardTroubleDismissed' }
  | { type: 'cardNoticeDismissed' }
  | { type: 'cardEditOpened'; position: number }
  | { type: 'cardEditChanged'; name: string }
  /** The person tried to save, so a missing or wrong name should now be pointed out. */
  | { type: 'cardEditTried' }
  | { type: 'cardEditClosed' }

const CARD_STATE_ACTIONS: readonly string[] = [
  'cardCopyRequested',
  'cardMoveRequested',
  'cardDeleteRequested',
  'cardDeleteTriedWithoutPicking',
  'cardDialogClosed',
  'cardSaveStarted',
  'cardSaved',
  'cardNotChanged',
  'cardTroubleDismissed',
  'cardNoticeDismissed',
  'cardEditOpened',
  'cardEditChanged',
  'cardEditTried',
  'cardEditClosed',
] satisfies CardStateAction['type'][]

export const isCardStateAction = (action: { type: string }): action is CardStateAction =>
  CARD_STATE_ACTIONS.includes(action.type)

export const isCardFull = (card: CardState): boolean => card.reading.models.length >= PLACES

export function cardReducer(card: CardState, action: CardStateAction): CardState {
  switch (action.type) {
    case 'cardCopyRequested':
      // A full card has no room for a copy, so the question of its name is never asked.
      return isCardFull(card)
        ? { ...card, trouble: { kind: 'refused', problem: 'cardFull' } }
        : { ...card, dialog: { type: 'copy', position: action.position } }

    case 'cardMoveRequested':
      return { ...card, dialog: { type: 'move', fromPosition: action.position, toPosition: action.toPosition } }

    case 'cardDeleteRequested':
      return { ...card, dialog: { type: 'delete', position: action.position } }

    case 'cardDeleteTriedWithoutPicking':
      return card.dialog?.type === 'delete' ? { ...card, dialog: { ...card.dialog, triedWithoutPicking: true } } : card

    case 'cardDialogClosed':
      return { ...card, dialog: null }

    case 'cardSaveStarted':
      return { ...card, saving: true, dialog: null }

    case 'cardSaved':
      return { ...cardStateFor(action.files), hasSaved: true, notice: action.notice }

    case 'cardNotChanged':
      return { ...card, saving: false, dialog: null, trouble: action.trouble }

    case 'cardTroubleDismissed':
      return { ...card, trouble: null }

    case 'cardNoticeDismissed':
      return { ...card, notice: null }

    case 'cardEditOpened': {
      const model = card.reading.models.find((candidate) => candidate.position === action.position)
      if (!model || model.name === null) return card
      return { ...card, edit: { position: model.position, name: model.name, tried: false }, notice: null, dialog: null }
    }

    case 'cardEditChanged':
      return card.edit ? { ...card, edit: { ...card.edit, name: action.name } } : card

    case 'cardEditTried':
      return card.edit ? { ...card, edit: { ...card.edit, tried: true } } : card

    case 'cardEditClosed':
      return { ...card, edit: null }
  }
}
