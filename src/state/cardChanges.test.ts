import { expect, test } from 'vitest'
import { modelPath, RADIO_SETTINGS_PATH } from '../files/card.ts'
import { copyOnCard, deleteFromCard, moveOnCard, renameOnCard } from '../files/cardActions.ts'
import { applyChanges, changesBetween } from '../files/changes.ts'
import { bytesFromText } from '../files/document.ts'
import { made, madeUpCard, sameCard } from '../test/madeUpCard.tsx'
import { planChange, type CardAct, type PlannedChange } from './cardChanges.ts'
import { initialState, reducer } from './appState.ts'
import { cardReducer, cardStateFor, type CardState } from './cardState.ts'

const start = (): CardState => cardStateFor(madeUpCard())

function planned(act: CardAct, card: CardState, whenDeleting: 'closeUp' | 'leaveEmpty' = 'closeUp'): Extract<PlannedChange, { ok: true }> {
  const plan = planChange(act, card, whenDeleting)
  if (!plan.ok) throw new Error(`refused: ${plan.problem}`)
  return plan
}
/** The card after a planned change is saved, as the screen would then hold it. */
const after = (card: CardState, plan: Extract<PlannedChange, { ok: true }>): CardState =>
  cardReducer(card, {
    type: 'cardSaved',
    files: applyChanges(card.files, plan.changes),
    notice: { change: plan.change, undo: card.files, backupMade: false },
  })

test('each thing a person can do is the card logic\'s own change, with the facts for its confirmation', () => {
  const card = start()
  const { files } = card

  const copy = planned({ kind: 'copy', position: 2, name: ' Shingle ' }, card)
  expect(copy.changes).toEqual(made(copyOnCard(files, 2, 'Shingle')).changes)
  expect(copy.change).toEqual({ kind: 'copied', modelName: 'Shingle', position: 4 })

  const rename = planned({ kind: 'rename', position: 1, name: 'Boulder' }, card)
  expect(rename.changes).toEqual(made(renameOnCard(files, 1, 'Boulder')).changes)
  expect(rename.change).toEqual({ kind: 'renamed', was: 'Pebble', now: 'Boulder', position: 1 })

  const move = planned({ kind: 'move', from: 3, to: 5 }, card)
  expect(move.changes).toEqual(made(moveOnCard(files, 3, 5)).changes)
  expect(move.change).toEqual({ kind: 'moved', modelName: 'Mudskipper', fromPosition: 3, position: 5 })

  expect(planned({ kind: 'move', from: 4, to: 1 }, card).change).toEqual({ kind: 'emptyMoved', fromPosition: 4, position: 1 })
  expect(planned({ kind: 'closeUp' }, card).change).toEqual({ kind: 'closedUp', modelCount: 5 })
})

test('a delete follows the Radio setup answer, and says which models moved up', () => {
  const card = start()

  const closedUp = planned({ kind: 'delete', position: 2 }, card, 'closeUp')
  expect(closedUp.changes).toEqual(made(deleteFromCard(card.files, 2, { closeUp: true })).changes)
  expect(closedUp.change).toEqual({
    kind: 'deleted',
    modelName: 'Gravel Cat',
    position: 2,
    shift: { count: 3, first: 3, last: 6, direction: 'up', only: null },
  })

  const leftEmpty = planned({ kind: 'delete', position: 2 }, card, 'leaveEmpty')
  expect(leftEmpty.changes).toEqual(made(deleteFromCard(card.files, 2, { closeUp: false })).changes)
  expect(leftEmpty.change).toMatchObject({ kind: 'deleted', shift: null })

  // The last model but one: the one model after it is named.
  expect(planned({ kind: 'delete', position: 5, switchTo: 1 }, card).change).toMatchObject({
    shift: { count: 1, only: { name: 'Bog Hopper', position: 6 } },
  })
  // The radio's own model needs another to switch to.
  expect(planChange({ kind: 'delete', position: 5 }, card, 'closeUp')).toEqual({ ok: false, problem: 'switchToNeeded' })
})

test('a restore says where the model is again, and which models made room for it', () => {
  const card = start()
  const gone = after(card, planned({ kind: 'delete', position: 2 }, card))
  const deletedFile = gone.reading.deleted[0].path

  // Its old place has been taken since, so the models from there to the next empty place move down.
  const back = planned({ kind: 'restore', path: deletedFile }, gone)
  expect(back.change).toEqual({
    kind: 'restored',
    modelName: 'Gravel Cat',
    position: 2,
    shift: { count: 1, first: 2, last: 2, direction: 'down', only: { name: 'Mudskipper', position: 2 } },
  })

  // With its place left empty, nothing has to move.
  const left = after(card, planned({ kind: 'delete', position: 2 }, card, 'leaveEmpty'))
  expect(planned({ kind: 'restore', path: left.reading.deleted[0].path }, left).change).toMatchObject({
    position: 2,
    shift: { count: 0 },
  })
})

test('undo is the change back to the card as it was before, byte for byte, for the last change only', () => {
  const card = start()
  const plan = planned({ kind: 'delete', position: 5, switchTo: 1 }, card)
  const changed = after(card, plan)

  const undo = planned({ kind: 'undo' }, changed)
  expect(undo.changes).toEqual(changesBetween(changed.files, card.files))
  expect(sameCard(applyChanges(changed.files, undo.changes), card.files)).toBe(true)
  expect(undo.change).toEqual({ kind: 'undone', of: plan.change })

  // With no change to go back from, there is nothing to do.
  expect(planned({ kind: 'undo' }, card).changes).toEqual([])
})

test('a model whose file could not be read has no name to say, and can still be moved and deleted', () => {
  const files = new Map(madeUpCard()).set(modelPath(2), bytesFromText('not a model\n'))
  const card = cardStateFor(files)

  expect(planned({ kind: 'move', from: 2, to: 4 }, card).change).toEqual({ kind: 'moved', modelName: null, fromPosition: 2, position: 4 })
  expect(planned({ kind: 'delete', position: 2 }, card).change).toMatchObject({ kind: 'deleted', modelName: null })
  expect(planChange({ kind: 'copy', position: 2, name: 'Shingle' }, card, 'closeUp')).toEqual({ ok: false, problem: 'modelNotRead' })
  expect(planChange({ kind: 'rename', position: 2, name: 'Shingle' }, card, 'closeUp')).toEqual({ ok: false, problem: 'modelNotRead' })
})

test('what the card logic refuses is given back as its reason', () => {
  const wrongCheck = new Map(madeUpCard())
  wrongCheck.set(RADIO_SETTINGS_PATH, bytesFromText(new TextDecoder().decode(wrongCheck.get(RADIO_SETTINGS_PATH)).replace(/^checksum: \d+/, 'checksum: 4242')))
  const card = cardStateFor(wrongCheck)

  // Moving the radio's model would have to change the settings file, and its check number is wrong.
  expect(planChange({ kind: 'move', from: 5, to: 1 }, card, 'closeUp')).toEqual({ ok: false, problem: 'checksumWrong' })
  // A change that leaves the settings alone is still made.
  expect(planChange({ kind: 'rename', position: 1, name: 'Boulder' }, card, 'closeUp').ok).toBe(true)
  expect(planChange({ kind: 'rename', position: 1, name: 'Rock "n"' }, card, 'closeUp')).toEqual({ ok: false, problem: 'cannotBeWritten' })
})

test('the state for a real card: dialogs, the name page, a save running, and what follows it', () => {
  let card = start()

  card = cardReducer(card, { type: 'cardCopyRequested', position: 2 })
  expect(card.dialog).toEqual({ type: 'copy', position: 2 })
  card = cardReducer(card, { type: 'cardSaveStarted' })
  expect([card.saving, card.dialog]).toEqual([true, null])

  // A save that was not made leaves the card as it was, with the reason to show.
  const notMade = cardReducer(card, { type: 'cardNotChanged', trouble: { kind: 'notAllowed' } })
  expect([notMade.saving, notMade.trouble, notMade.files === card.files]).toEqual([false, { kind: 'notAllowed' }, true])
  expect(cardReducer(notMade, { type: 'cardTroubleDismissed' }).trouble).toBeNull()

  // The name page opens with the model's name, and only for a model whose file was read.
  const editing = cardReducer(start(), { type: 'cardEditOpened', position: 1 })
  expect(editing.edit).toEqual({ position: 1, name: 'Pebble', tried: false })
  expect(cardReducer(editing, { type: 'cardEditChanged', name: 'Boulder' }).edit?.name).toBe('Boulder')
  expect(cardReducer(start(), { type: 'cardEditOpened', position: 4 }).edit).toBeNull()

  // A save that was made starts the state afresh from the files that are now on the card.
  const plan = planned({ kind: 'rename', position: 1, name: 'Boulder' }, editing)
  const saved = after(editing, plan)
  expect(saved.reading.models[0].name).toBe('Boulder')
  expect([saved.saving, saved.edit, saved.hasSaved, saved.notice?.change.kind]).toEqual([false, null, true, 'renamed'])
})

test('there is one confirmation at a time: Radio setup\'s and a saved change take each other\'s place', () => {
  const files = madeUpCard()
  let state = reducer(initialState(true), { type: 'cardConnected', files })
  const plan = planned({ kind: 'closeUp' }, state.card!)
  const saved = { type: 'cardSaved', files: applyChanges(files, plan.changes), notice: { change: plan.change, undo: files, backupMade: true } } as const

  state = reducer(state, saved)
  expect([state.notice, state.card?.notice?.change.kind]).toEqual([null, 'closedUp'])

  state = reducer(state, { type: 'radioSetupSaved', baseFitting: 'blankCover', whenDeleting: 'leaveEmpty' })
  expect([state.notice?.kind, state.card?.notice]).toEqual(['radioSetupSaved', null])

  state = reducer(state, saved)
  expect([state.notice, state.card?.notice?.change.kind]).toEqual([null, 'closedUp'])

  // Unplugging, or a folder that can no longer be read, ends the real card.
  expect(reducer(state, { type: 'disconnected' }).card).toBeNull()
  expect(reducer(state, { type: 'wrongFolderPicked' }).card).toBeNull()
})

