// What to call a real card's models, and what to say once a change to the card is saved.
//
// The sentences are the ones the sample list uses for the same change. A model whose file could
// not be read has no name to say, so it is called by its position.

import type { CardProblem } from '../../files/cardActions.ts'
import type { CardChange, CardShift } from '../../state/cardState.ts'
import { strings } from '../../strings/en.ts'

const text = strings.card
const say = strings.notice

/** A model's name for the middle of a sentence, such as "Delete … ?". */
export const spokenName = (model: { name: string | null; position: number }): string =>
  model.name || text.unnamed(model.position)

/** A model's name for the start of a sentence, or to stand on its own in a list. */
export const spokenNameFirst = (model: { name: string | null; position: number }): string =>
  model.name || text.unnamedFirst(model.position)

/** The other models a change moved, in one sentence, or null when none did. */
function shiftWords(shift: CardShift): string | null {
  if (shift.count === 0) return null
  if (shift.only) return say.oneMoved(spokenNameFirst(shift.only), shift.direction)
  return say.othersMoved(shift.count, shift.first, shift.last, shift.direction)
}

const backWords = (name: string | null, position: number): string =>
  name ? say.restored(name, position) : text.saved.restoredUnnamed(position)

/** What a saved change did, in plain words. */
export function changeWords(change: CardChange): string {
  switch (change.kind) {
    case 'copied':
      return say.added(change.modelName, change.position)
    case 'moved':
      return change.modelName
        ? say.moved(change.modelName, change.position)
        : text.saved.movedUnnamed(change.fromPosition, change.position)
    case 'emptyMoved':
      return say.emptyMoved(change.fromPosition, change.position)
    case 'closedUp':
      return say.closedUp(change.modelCount)
    case 'restored':
      return [backWords(change.modelName, change.position), shiftWords(change.shift)].filter(Boolean).join(' ')
    case 'deleted': {
      let rest: string | null
      if (change.shift === null) rest = say.leftEmpty(change.position)
      else if (change.shift.count > 1) rest = say.othersAfterMovedUp(change.shift.count)
      else rest = shiftWords(change.shift)
      const gone = change.modelName ? say.deleted(change.modelName) : text.saved.deletedUnnamed(change.position)
      return [gone, rest, say.copyKept].filter(Boolean).join(' ')
    }
    case 'renamed':
      return strings.editModel.saved.renamed(change.was || text.noName, change.now)
    case 'undone': {
      // Say where a model is again, as the sample list does. Any other change is just undone.
      const { of } = change
      if (of.kind === 'deleted') return backWords(of.modelName, of.position)
      if (of.kind === 'moved') return backWords(of.modelName, of.fromPosition)
      if (of.kind === 'renamed') return strings.editModel.saved.undone(of.was || text.noName)
      return say.undone
    }
  }
}

/** True for a change made on a model's Edit page, which is confirmed there as well as in the list. */
export const isRename = (change: CardChange): boolean =>
  change.kind === 'renamed' || (change.kind === 'undone' && change.of.kind === 'renamed')

/** The position of the model a rename, or its undoing, was about. */
export const renamedPosition = (change: CardChange): number | null => {
  const rename = change.kind === 'undone' ? change.of : change
  return rename.kind === 'renamed' ? rename.position : null
}

/** Why the app would not make a change, in one plain sentence. */
export function refusalWords(problem: CardProblem): string {
  const refused = text.trouble.refused
  switch (problem) {
    case 'checksumWrong':
    case 'radioSettingsNotRead':
    case 'switchToNeeded':
    case 'modelNotRead':
      return refused[problem]
    case 'notPlain':
    case 'cannotBeWritten':
      return refused.nameNotKept
    default:
      return refused.notWhereExpected
  }
}
