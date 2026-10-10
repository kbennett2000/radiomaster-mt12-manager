import { useCallback, type Dispatch } from 'react'
import { Button, ButtonLink } from '../../components/Button.tsx'
import { CloseIcon, PlusIcon, UndoIcon } from '../../components/icons.tsx'
import { Notice } from '../../components/Notice.tsx'
import { MT12 } from '../../domain/catalog.ts'
import type { Model } from '../../domain/model.ts'
import { modelsAfter } from '../../domain/positions.ts'
import {
  isEditChange,
  isRadioFull,
  type Action,
  type AppState,
  type EditChange,
  type Notice as Change,
  type Shift,
} from '../../state/appState.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import { DeleteDialog } from '../delete/DeleteDialog.tsx'
import { EditNotice } from '../editModel/EditNotice.tsx'
import { CopyDialog } from './CopyDialog.tsx'
import { CurrentModelStrip } from './CurrentModelStrip.tsx'
import { ModelList } from './ModelList.tsx'
import styles from './ModelsScreen.module.css'
import { MoveDialog } from './MoveDialog.tsx'
import { RadioFullDialog } from './RadioFullDialog.tsx'
import { RecentlyDeleted } from './RecentlyDeleted.tsx'

interface ModelsScreenProps {
  state: AppState
  dispatch: Dispatch<Action>
  /** Opens the "Add a model" wizard. `position` is the empty place it was opened from, if any. */
  onAdd: (position?: number) => void
}

type ScreenParts = Pick<ModelsScreenProps, 'state' | 'dispatch'>

const text = strings.models

interface AddModelActionProps {
  full: boolean
  onFull: () => void
  onAdd: () => void
}

function AddModelAction({ full, onFull, onAdd }: AddModelActionProps) {
  // When the radio is full the action stays where it is and explains why it cannot add.
  return full ? (
    <Button variant="primary" size="large" icon={<PlusIcon />} onClick={onFull}>
      {text.addModel}
    </Button>
  ) : (
    <ButtonLink
      variant="primary"
      size="large"
      icon={<PlusIcon />}
      href={paths.addStep('name')}
      onClick={(event) => {
        event.preventDefault()
        onAdd()
      }}
    >
      {text.addModel}
    </ButtonLink>
  )
}

/** The other models a change moved, in one sentence, or null when none did. */
function shiftWords(shift: Shift): string | null {
  if (shift.count === 0) return null
  if (shift.onlyName) return strings.notice.oneMoved(shift.onlyName, shift.direction)
  return strings.notice.othersMoved(shift.count, shift.first, shift.last, shift.direction)
}

/** What the last change did, in plain words. */
function noticeWords(notice: Exclude<Change, { kind: 'radioSetupSaved' } | EditChange>): string {
  const say = strings.notice
  switch (notice.kind) {
    case 'added':
    case 'copied':
      return say.added(notice.modelName, notice.position)
    case 'moved':
      return say.moved(notice.modelName, notice.position)
    case 'emptyMoved':
      return say.emptyMoved(notice.fromPosition, notice.position)
    case 'closedUp':
      return say.closedUp(notice.modelCount)
    case 'undone':
      return say.undone
    case 'restored':
      return [say.restored(notice.modelName, notice.position), shiftWords(notice.shift)].filter(Boolean).join(' ')
    case 'deleted': {
      let rest: string | null
      if (notice.shift === null) rest = say.leftEmpty(notice.position)
      else if (notice.shift.count > 1) rest = say.othersAfterMovedUp(notice.shift.count)
      else rest = shiftWords(notice.shift)
      return [say.deleted(notice.modelName), rest, say.copyKept].filter(Boolean).join(' ')
    }
  }
}

function ChangeNotice({ state, dispatch }: ScreenParts) {
  const notice = state.notice
  if (!notice) return null

  const dismiss = (
    <Button variant="quiet" icon={<CloseIcon />} onClick={() => dispatch({ type: 'noticeDismissed' })}>
      {strings.notice.dismiss}
    </Button>
  )

  // A change made on a model's Edit page is confirmed the same way here as there.
  if (isEditChange(notice)) {
    return (
      <EditNotice
        notice={notice}
        onUndo={() => dispatch({ type: 'changeUndone' })}
        onDismiss={() => dispatch({ type: 'noticeDismissed' })}
      />
    )
  }

  if (notice.kind === 'radioSetupSaved') {
    return (
      <Notice title={strings.notice.radioSetupTitle} actions={dismiss} announceKey={notice}>
        {strings.notice.radioSetupBody}
      </Notice>
    )
  }

  return (
    <Notice
      title={strings.notice.savedTitle}
      announceKey={notice}
      actions={
        <>
          {'before' in notice && (
            <Button icon={<UndoIcon />} onClick={() => dispatch({ type: 'changeUndone' })}>
              {strings.notice.undo}
            </Button>
          )}
          {dismiss}
        </>
      }
    >
      {noticeWords(notice)}
    </Notice>
  )
}

/** What deleting a model will do to the rest of the list, said before the person confirms. */
function whatElseHappens(state: AppState, model: Model): string {
  const say = strings.deleteModel
  if (state.whenDeleting === 'leaveEmpty') return say.willLeaveEmpty(model.position)
  const after = modelsAfter(state.models, model.position)
  if (after.length === 0) return say.lastInList
  if (after.length === 1) return say.oneWillMoveUp(after[0].name)
  return say.othersWillMoveUp(after.length)
}

function OpenDialog({ state, dispatch }: ScreenParts) {
  const dialog = state.dialog
  const close = () => dispatch({ type: 'dialogClosed' })
  if (!dialog) return null
  if (dialog.type === 'radioFull') return <RadioFullDialog onClose={close} />

  if (dialog.type === 'move') {
    return (
      <MoveDialog
        fromPosition={dialog.fromPosition}
        models={state.models}
        toPosition={dialog.toPosition}
        onConfirm={(toPosition) => dispatch({ type: 'placeMoved', fromPosition: dialog.fromPosition, toPosition })}
        onCancel={close}
      />
    )
  }

  const model = state.models.find((candidate) => candidate.id === dialog.modelId)
  if (!model) return null

  if (dialog.type === 'copy') {
    return (
      <CopyDialog
        model={model}
        namesInUse={state.models.map((other) => other.name)}
        draftName={dialog.draftName}
        onConfirm={(name) => dispatch({ type: 'copyConfirmed', modelId: model.id, name })}
        onCancel={close}
      />
    )
  }

  const isCurrent = state.currentModelId === model.id
  return (
    <DeleteDialog
      model={model}
      whatElseHappens={whatElseHappens(state, model)}
      switchChoices={isCurrent ? state.models.filter((other) => other.id !== model.id) : []}
      switchToId={dialog.switchToId}
      triedWithoutPicking={dialog.triedWithoutPicking === true}
      onConfirm={(switchToId) => dispatch({ type: 'deleteConfirmed', modelId: model.id, switchToId })}
      onKeep={close}
    />
  )
}

export function ModelsScreen({ state, dispatch, onAdd }: ModelsScreenProps) {
  const full = isRadioFull(state)
  const empty = state.models.length === 0
  const current = state.models.find((model) => model.id === state.currentModelId)
  const explainFull = () => dispatch({ type: 'addRequestedWhileFull' })
  const newModelMarked = useCallback(() => dispatch({ type: 'newModelMarked' }), [dispatch])

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1>{text.title}</h1>
        {!empty && <p className={styles.hint}>{text.reorderHint}</p>}
        {!empty && <AddModelAction full={full} onFull={explainFull} onAdd={() => onAdd()} />}
      </div>

      {full && <p className={styles.full}>{text.fullBanner(MT12.maxModels)}</p>}

      <div className={styles.notice} role="status">
        <ChangeNotice state={state} dispatch={dispatch} />
      </div>

      {empty ? (
        <div className={styles.empty}>
          <h2>{text.empty.title}</h2>
          <p className={styles.emptyBody}>{text.empty.body}</p>
          <AddModelAction full={full} onFull={explainFull} onAdd={() => onAdd()} />
        </div>
      ) : (
        <>
          {current && <CurrentModelStrip model={current} />}
          <ModelList
            models={state.models}
            currentModelId={state.currentModelId}
            onCopy={(modelId) => dispatch({ type: 'copyRequested', modelId })}
            onMoveRequested={(position) => dispatch({ type: 'moveRequested', position })}
            onMoved={(fromPosition, toPosition) => dispatch({ type: 'placeMoved', fromPosition, toPosition })}
            onDelete={(modelId) => dispatch({ type: 'deleteRequested', modelId })}
            onCloseUp={() => dispatch({ type: 'emptyPlacesClosedUp' })}
            onAddAt={onAdd}
            newModelId={state.newModelId}
            onNewModelMarked={newModelMarked}
          />
        </>
      )}

      {state.recentlyDeleted.length > 0 && (
        <RecentlyDeleted
          deleted={state.recentlyDeleted}
          onRestore={(modelId) => dispatch({ type: 'restoreRequested', modelId })}
        />
      )}

      <OpenDialog state={state} dispatch={dispatch} />
    </div>
  )
}
