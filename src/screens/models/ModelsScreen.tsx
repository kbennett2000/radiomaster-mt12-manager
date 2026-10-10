import type { Dispatch } from 'react'
import { Button, ButtonLink } from '../../components/Button.tsx'
import { CloseIcon, PlusIcon, UndoIcon } from '../../components/icons.tsx'
import { Notice } from '../../components/Notice.tsx'
import { MT12 } from '../../domain/catalog.ts'
import { isRadioFull, type Action, type AppState } from '../../state/appState.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import { DeleteDialog } from '../delete/DeleteDialog.tsx'
import { CopyDialog } from './CopyDialog.tsx'
import { ModelCard } from './ModelCard.tsx'
import styles from './ModelsScreen.module.css'
import { RadioFullDialog } from './RadioFullDialog.tsx'
import { RecentlyDeleted } from './RecentlyDeleted.tsx'

interface ModelsScreenProps {
  state: AppState
  dispatch: Dispatch<Action>
}

const text = strings.models

function AddModelAction({ full, onFull }: { full: boolean; onFull: () => void }) {
  // When the radio is full the action stays where it is and explains why it cannot add.
  return full ? (
    <Button variant="primary" size="large" icon={<PlusIcon />} onClick={onFull}>
      {text.addModel}
    </Button>
  ) : (
    <ButtonLink variant="primary" size="large" icon={<PlusIcon />} href={paths.addModel}>
      {text.addModel}
    </ButtonLink>
  )
}

function ChangeNotice({ state, dispatch }: ModelsScreenProps) {
  const notice = state.notice
  if (!notice) return null

  const dismiss = (
    <Button variant="quiet" icon={<CloseIcon />} onClick={() => dispatch({ type: 'noticeDismissed' })}>
      {strings.notice.dismiss}
    </Button>
  )

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
          {notice.kind === 'deleted' && (
            <Button icon={<UndoIcon />} onClick={() => dispatch({ type: 'deleteUndone' })}>
              {strings.notice.undo}
            </Button>
          )}
          {dismiss}
        </>
      }
    >
      {strings.notice[notice.kind](notice.modelName)} {strings.notice.safeToUnplug}
    </Notice>
  )
}

function OpenDialog({ state, dispatch }: ModelsScreenProps) {
  const dialog = state.dialog
  const close = () => dispatch({ type: 'dialogClosed' })
  if (!dialog) return null
  if (dialog.type === 'radioFull') return <RadioFullDialog onClose={close} />

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
      switchChoices={isCurrent ? state.models.filter((other) => other.id !== model.id) : []}
      switchToId={dialog.switchToId}
      triedWithoutPicking={dialog.triedWithoutPicking === true}
      onConfirm={(switchToId) => dispatch({ type: 'deleteConfirmed', modelId: model.id, switchToId })}
      onKeep={close}
    />
  )
}

export function ModelsScreen({ state, dispatch }: ModelsScreenProps) {
  const full = isRadioFull(state)
  const empty = state.models.length === 0
  const explainFull = () => dispatch({ type: 'addRequestedWhileFull' })

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1>{text.title}</h1>
        {!empty && <AddModelAction full={full} onFull={explainFull} />}
      </div>

      {full && <p className={styles.full}>{text.fullBanner(MT12.maxModels)}</p>}

      <div className={styles.notice} role="status">
        <ChangeNotice state={state} dispatch={dispatch} />
      </div>

      {empty ? (
        <div className={styles.empty}>
          <h2>{text.empty.title}</h2>
          <p className={styles.emptyBody}>{text.empty.body}</p>
          <AddModelAction full={full} onFull={explainFull} />
        </div>
      ) : (
        <ul className={styles.grid}>
          {state.models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              isCurrent={model.id === state.currentModelId}
              onCopy={() => dispatch({ type: 'copyRequested', modelId: model.id })}
              onDelete={() => dispatch({ type: 'deleteRequested', modelId: model.id })}
            />
          ))}
        </ul>
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
