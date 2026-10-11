// Working out one change to a real card: the file changes to save, and what to say once they are.
//
// Nothing here touches a folder. Each thing a person can do to the list is put to the card logic
// in src/files/cardActions.ts, which gives the new card and the ordered list of file changes. This
// adds the words' worth of facts for the confirmation: which model, where it went, what else moved.

import { restoreModel, type WhenDeleting } from '../domain/positions.ts'
import { deletedFrom, PLACES, type CardModel } from '../files/card.ts'
import {
  closeUpOnCard,
  copyOnCard,
  deleteFromCard,
  moveOnCard,
  renameOnCard,
  restoreOnCard,
  type CardProblem,
  type CardResult,
} from '../files/cardActions.ts'
import { changesBetween, type Change } from '../files/changes.ts'
import type { CardChange, CardShift, CardState, CardStateAction } from './cardState.ts'

/** One thing a person can do to a real card's list. Positions count from 1. */
export type CardAct =
  | { kind: 'copy'; position: number; name: string }
  | { kind: 'move'; from: number; to: number }
  /** `switchTo` is the position of the model the radio should switch to, when it is set to the one being deleted. */
  | { kind: 'delete'; position: number; switchTo?: number }
  /** `path` is the deleted model's file. */
  | { kind: 'restore'; path: string }
  | { kind: 'closeUp' }
  | { kind: 'rename'; position: number; name: string }
  /** Puts the card back as it was before the last change. */
  | { kind: 'undo' }

/**
 * One thing to do to a card as soon as it is open. A reviewer's link gives a list of these, so
 * that it lands on the state that follows them. They are carried out by the code a click runs.
 */
export type CardStep =
  | CardAct
  /** Brings back the model that was deleted last. */
  | { kind: 'restoreNewest' }
  /** Something that only changes what is on screen, such as opening a page with a name typed in. */
  | { kind: 'show'; action: CardStateAction }

/** A change worked out and ready to save, or the reason the card logic will not make it. */
export type PlannedChange =
  | { ok: true; changes: readonly Change[]; change: CardChange }
  | { ok: false; problem: CardProblem }

/** Sums up a group of models that all moved one place the same way. `moved` is how they stood before. */
function shiftOf(moved: readonly CardModel[], direction: 'up' | 'down'): CardShift {
  return {
    count: moved.length,
    first: moved[0]?.position ?? 0,
    last: moved[moved.length - 1]?.position ?? 0,
    direction,
    only: moved.length === 1 ? { name: moved[0].name, position: moved[0].position } : null,
  }
}

const planned = (result: CardResult, change: CardChange): PlannedChange =>
  result.ok ? { ok: true, changes: result.changes, change } : { ok: false, problem: result.problem }

/**
 * Works out what a person asked for. `whenDeleting` is the answer from Radio setup: close up the
 * list after a delete, or leave the place empty.
 */
export function planChange(act: CardAct, card: CardState, whenDeleting: WhenDeleting): PlannedChange {
  const { files, reading } = card
  const modelIn = (position: number) => reading.models.find((model) => model.position === position)

  switch (act.kind) {
    case 'copy': {
      const result = copyOnCard(files, act.position, act.name)
      return planned(result, { kind: 'copied', modelName: act.name.trim(), position: result.ok ? result.position : 0 })
    }

    case 'rename':
      return planned(renameOnCard(files, act.position, act.name), {
        kind: 'renamed',
        was: modelIn(act.position)?.name ?? '',
        now: act.name.trim(),
        position: act.position,
      })

    case 'move': {
      const model = modelIn(act.from)
      return planned(
        moveOnCard(files, act.from, act.to),
        model
          ? { kind: 'moved', modelName: model.name, fromPosition: act.from, position: act.to }
          : { kind: 'emptyMoved', fromPosition: act.from, position: act.to },
      )
    }

    case 'closeUp':
      return planned(closeUpOnCard(files), { kind: 'closedUp', modelCount: reading.models.length })

    case 'delete': {
      const closeUp = whenDeleting === 'closeUp'
      const after = reading.models.filter((model) => model.position > act.position)
      return planned(deleteFromCard(files, act.position, { closeUp, switchTo: act.switchTo }), {
        kind: 'deleted',
        modelName: modelIn(act.position)?.name ?? null,
        position: act.position,
        shift: closeUp ? shiftOf(after, 'up') : null,
      })
    }

    case 'restore': {
      const result = restoreOnCard(files, act.path)
      // The same rule the card logic used says which models had to make room, and which way they went.
      const from = deletedFrom(act.path)
      const placed = reading.models.map((model) => ({ id: model.path, position: model.position }))
      const room = from ? restoreModel(placed, { id: act.path, position: from.cameFrom }, PLACES) : null
      const moved = (room?.moved ?? []).flatMap((item) => reading.models.find((model) => model.path === item.id) ?? [])
      return planned(result, {
        kind: 'restored',
        modelName: reading.deleted.find((deleted) => deleted.path === act.path)?.name ?? null,
        position: result.ok ? result.position : 0,
        shift: shiftOf(moved, room?.direction ?? 'down'),
      })
    }

    case 'undo': {
      const last = card.notice
      // Undo is only offered while there is a card to go back to, so there is nothing to do without one.
      if (!last?.undo) return { ok: true, changes: [], change: { kind: 'closedUp', modelCount: reading.models.length } }
      return { ok: true, changes: changesBetween(files, last.undo), change: { kind: 'undone', of: last.change } }
    }
  }
}
