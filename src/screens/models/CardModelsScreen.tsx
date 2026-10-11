import type { Dispatch } from 'react'
import { MT12 } from '../../domain/catalog.ts'
import type { WhenDeleting } from '../../domain/positions.ts'
import { RADIO_SETTINGS_PATH, type CardModel, type CardReading, type DeletedModel } from '../../files/card.ts'
import type { Action, Notice } from '../../state/appState.ts'
import { isCardFull, type CardState } from '../../state/cardState.ts'
import { strings } from '../../strings/en.ts'
import { CardSavedNotice } from '../card/CardSavedNotice.tsx'
import type { CardActions } from '../card/useCardActions.ts'
import { DeleteDialog } from '../delete/DeleteDialog.tsx'
import { CardCurrentStrip } from './CardCurrentStrip.tsx'
import { CardModelList } from './CardModelList.tsx'
import { spokenName, spokenNameFirst } from './cardWords.ts'
import { CopyDialog } from './CopyDialog.tsx'
import styles from './ModelsScreen.module.css'
import { MoveDialog } from './MoveDialog.tsx'
import { RadioSetupNotice } from './RadioSetupNotice.tsx'
import { RecentlyDeleted, type DeletedRow } from './RecentlyDeleted.tsx'

interface CardModelsScreenProps {
  /** The real card and what is going on with it. */
  card: CardState
  /** What a delete does to the rest of the list. Chosen in Radio setup. */
  whenDeleting: WhenDeleting
  /** The confirmation that Radio setup was saved, when that is the last thing that happened. */
  notice: Notice | null
  dispatch: Dispatch<Action>
  perform: CardActions['perform']
}

type ScreenParts = Pick<CardModelsScreenProps, 'card' | 'whenDeleting' | 'dispatch' | 'perform'>

const text = strings.card

/** What is wrong with the radio's settings file, one plain line for each thing. Usually nothing. */
function settingsProblems(reading: CardReading): string[] {
  const refused = reading.refused.find((file) => file.path === RADIO_SETTINGS_PATH)
  if (refused) return [text.settingsNotRead(strings.files.refused[refused.reason](refused.line))]

  const problems: string[] = []
  if (reading.checksum === null) problems.push(text.settingsCheckMissing)
  else if (!reading.checksum.right) problems.push(text.settingsCheckWrong)
  if (reading.currentPosition === null) problems.push(text.settingsNameNoModel)
  return problems
}

/** What deleting a model will do to the rest of the list, said before the person confirms. */
function whatElseHappens(reading: CardReading, model: CardModel, whenDeleting: WhenDeleting): string {
  const say = strings.deleteModel
  if (whenDeleting === 'leaveEmpty') return say.willLeaveEmpty(model.position)
  const after = reading.models.filter((other) => other.position > model.position)
  if (after.length === 0) return say.lastInList
  if (after.length === 1) return say.oneWillMoveUp(spokenNameFirst(after[0]))
  return say.othersWillMoveUp(after.length)
}

/** A deleted model as "Recently deleted" shows it. One whose file could not be read still shows, by its position. */
const deletedRow = (deleted: DeletedModel): DeletedRow => ({
  id: deleted.path,
  name: deleted.name === null ? text.deletedNotRead : deleted.name || text.noName,
  detail:
    deleted.name === null ? '' : deleted.receiverTypeId ? strings.receiverTypes[deleted.receiverTypeId] : text.receiverNotKnown,
  position: deleted.cameFrom,
})

/** The sample list's own dialogs, asking about a model on the real card. */
function OpenDialog({ card, whenDeleting, dispatch, perform }: ScreenParts) {
  const { dialog, reading } = card
  if (!dialog) return null
  const close = () => dispatch({ type: 'cardDialogClosed' })

  if (dialog.type === 'move') {
    return (
      <MoveDialog
        fromPosition={dialog.fromPosition}
        models={reading.models.map((model) => ({ id: model.path, position: model.position, name: spokenNameFirst(model) }))}
        toPosition={dialog.toPosition}
        onConfirm={(toPosition) => void perform({ kind: 'move', from: dialog.fromPosition, to: toPosition }, card)}
        onCancel={close}
      />
    )
  }

  const model = reading.models.find((candidate) => candidate.position === dialog.position)
  if (!model) return null

  if (dialog.type === 'copy') {
    return (
      <CopyDialog
        model={{ name: spokenName(model) }}
        namesInUse={reading.models.flatMap((other) => other.name ?? [])}
        plainOnly
        draftName={dialog.draftName}
        onConfirm={(name) => void perform({ kind: 'copy', position: model.position, name }, card)}
        onCancel={close}
      />
    )
  }

  // The radio cannot be left set to a model that is gone, so it is asked which one to switch to.
  const others = reading.models.filter((other) => other.position !== model.position)
  const choices = reading.currentPosition === model.position ? others : []
  return (
    <DeleteDialog
      model={{ id: String(model.position), name: spokenName(model) }}
      whatElseHappens={whatElseHappens(reading, model, whenDeleting)}
      switchChoices={choices.map((other) => ({ id: String(other.position), name: spokenNameFirst(other) }))}
      switchToId={dialog.switchTo === undefined ? undefined : String(dialog.switchTo)}
      triedWithoutPicking={dialog.triedWithoutPicking === true}
      onConfirm={(switchToId) => {
        if (choices.length > 0 && switchToId === undefined) dispatch({ type: 'cardDeleteTriedWithoutPicking' })
        else void perform({ kind: 'delete', position: model.position, switchTo: switchToId ? Number(switchToId) : undefined }, card)
      }}
      onKeep={close}
    />
  )
}

/**
 * "Your models" for a real card. It works as the sample list does, and every change is saved to
 * the card before the list shows it. Nothing is added from here yet, and a row does not yet say
 * what the model has.
 */
export function CardModelsScreen({ card, whenDeleting, notice, dispatch, perform }: CardModelsScreenProps) {
  const { reading } = card

  /** A row was dropped on another place. */
  function moved(from: number, to: number) {
    // The first change after a Connect has the browser ask the person, and a browser only lets a
    // page ask while a click is being handled. A drop has counted as one where I have tried it.
    // Where a browser says it does not, the Move dialog opens on that place, and its button is the click.
    const clickStillCounts = navigator.userActivation?.isActive ?? true
    if (!card.hasSaved && !clickStillCounts) dispatch({ type: 'cardMoveRequested', position: from, toPosition: to })
    else void perform({ kind: 'move', from, to }, card)
  }

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1>{strings.models.title}</h1>
        <p className={styles.hint}>{text.comingNext}</p>
      </div>

      {isCardFull(card) && <p className={styles.full}>{strings.models.fullBanner(MT12.maxModels)}</p>}

      <div className={styles.notice} role="status">
        {notice?.kind === 'radioSetupSaved' && (
          <RadioSetupNotice announceKey={notice} onDismiss={() => dispatch({ type: 'noticeDismissed' })} />
        )}
        {card.notice && (
          <CardSavedNotice
            notice={card.notice}
            onUndo={() => void perform({ kind: 'undo' }, card)}
            onDismiss={() => dispatch({ type: 'cardNoticeDismissed' })}
          />
        )}
      </div>

      {settingsProblems(reading).map((problem) => (
        <p key={problem} className={styles.full}>
          {problem}
        </p>
      ))}

      <CardCurrentStrip reading={reading} />
      <CardModelList
        reading={reading}
        onCopy={(position) => dispatch({ type: 'cardCopyRequested', position })}
        onMoveRequested={(position) => dispatch({ type: 'cardMoveRequested', position })}
        onMoved={moved}
        onDelete={(position) => dispatch({ type: 'cardDeleteRequested', position })}
        onCloseUp={() => void perform({ kind: 'closeUp' }, card)}
      />

      {reading.deleted.length > 0 && (
        <RecentlyDeleted
          deleted={reading.deleted.map(deletedRow)}
          onRestore={(path) => void perform({ kind: 'restore', path }, card)}
        />
      )}

      <OpenDialog card={card} whenDeleting={whenDeleting} dispatch={dispatch} perform={perform} />
    </div>
  )
}
