import { useCallback, useEffect, useRef, type Dispatch, type RefObject } from 'react'
import type { WhenDeleting } from '../../domain/positions.ts'
import type { CardConnection } from '../../platform/cardConnection.ts'
import type { SaveResult } from '../../platform/saveToFolder.ts'
import type { Action } from '../../state/appState.ts'
import { planChange, type CardAct } from '../../state/cardChanges.ts'
import { cardReducer, type CardState, type CardStateAction, type CardTrouble } from '../../state/cardState.ts'

export interface CardActions {
  /**
   * Works out a change to the card, saves it to the folder, and shows how that went. `card` is the
   * card as it stands when the person asks. Gives the card as it stands afterwards.
   *
   * It must be called straight from the person's click, with nothing awaited first. The browser
   * only lets a page ask to change files while a click is being handled, and the first save asks.
   *
   * `beforeShown` runs when the save has ended well, just before the screen is told, so that a
   * page can move the address on first.
   */
  perform(act: CardAct, card: CardState, beforeShown?: () => void): Promise<CardState>
  /** Reads the folder afresh and shows what is there, dropping everything the app held. */
  readAgain(): Promise<void>
}

/** What to tell the person when a save did not end well. */
function troubleFor(result: Extract<SaveResult, { ok: false }>): CardTrouble {
  switch (result.problem) {
    case 'notAllowed':
    case 'cardChanged':
    case 'backupFailed':
      return { kind: result.problem }
    case 'stoppedPartWay':
    case 'wentWrong':
      return { kind: 'didNotFinish' }
  }
}

/**
 * The things a person can do to a real card, each one saved to the folder before the screen
 * changes. `connection` is the folder the card was read from.
 */
export function useCardActions(
  connection: RefObject<CardConnection | null>,
  dispatch: Dispatch<Action>,
  whenDeleting: WhenDeleting,
): CardActions {
  // The answer from Radio setup, as it stands when a change is asked for. Keeping it here means
  // the functions below stay the same ones for as long as the card is connected.
  const deleting = useRef(whenDeleting)
  useEffect(() => {
    deleting.current = whenDeleting
  }, [whenDeleting])

  const perform = useCallback(
    async (act: CardAct, card: CardState, beforeShown?: () => void): Promise<CardState> => {
      /** Tells the screen, and gives the card as the screen will have it. */
      const tell = (from: CardState, action: CardStateAction): CardState => {
        dispatch(action)
        return cardReducer(from, action)
      }

      const planned = planChange(act, card, deleting.current)
      if (!planned.ok) return tell(card, { type: 'cardNotChanged', trouble: { kind: 'refused', problem: planned.problem } })
      const folder = connection.current
      if (planned.changes.length === 0 || !folder) return tell(card, { type: 'cardDialogClosed' })

      const saving = tell(card, { type: 'cardSaveStarted' })
      let result: SaveResult
      try {
        // Nothing has been awaited yet, so this call, and the browser's question inside it, are in the click.
        result = await folder.save(card.files, planned.changes)
      } catch {
        // The saver gives its problems back. Anything thrown is something it did not expect.
        result = { ok: false, problem: 'stoppedPartWay', stepsDone: 0 }
      }
      if (!result.ok) return tell(saving, { type: 'cardNotChanged', trouble: troubleFor(result) })

      beforeShown?.()
      return tell(saving, {
        type: 'cardSaved',
        files: result.card,
        notice: {
          change: planned.change,
          // Undo is offered for the last change only, and an undo is not itself undone.
          undo: act.kind === 'undo' ? null : card.files,
          backupMade: result.backup !== null,
        },
      })
    },
    [connection, dispatch],
  )

  const readAgain = useCallback(async () => {
    const folder = connection.current
    if (!folder) return
    const read = await folder.read()
    // A folder that can no longer be read as a card is no longer connected.
    dispatch(read.ok ? { type: 'cardReadAgain', files: read.card } : { type: 'wrongFolderPicked' })
  }, [connection, dispatch])

  return { perform, readAgain }
}
