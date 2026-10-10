import type { Dispatch, FormEvent, ReactNode } from 'react'
import { Button, ButtonLink } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import type { Model } from '../../domain/model.ts'
import type { BaseFitting } from '../../domain/radio.ts'
import type { Action } from '../../state/appState.ts'
import { partIsFine, problemsInEdit, type EditPart, type EditState } from '../../state/edit.ts'
import { goTo, paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import wizardStyles from '../addModel/AddModelScreen.module.css'
import { ExtrasStep } from '../addModel/ExtrasStep.tsx'
import { FeedbackStep } from '../addModel/FeedbackStep.tsx'
import { NameStep } from '../addModel/NameStep.tsx'
import { ReceiverStep } from '../addModel/ReceiverStep.tsx'
import { SteeringThrottleStep } from '../addModel/SteeringThrottleStep.tsx'
import type { StepProps } from '../addModel/stepProps.ts'
import { EditFrame } from './EditFrame.tsx'
import styles from './EditModel.module.css'

const text = strings.editModel

// Each part is asked about by the wizard step that asks about it for a new model.
const partScreens: Record<EditPart, (props: StepProps) => ReactNode> = {
  name: NameStep,
  receiver: ReceiverStep,
  steeringThrottle: SteeringThrottleStep,
  extras: ExtrasStep,
  feedback: FeedbackStep,
}

interface EditPartScreenProps {
  edit: EditState
  /** The model as it is on the radio. Nothing here changes it until "Save changes". */
  model: Model
  /** True when the radio is set to this model. */
  isCurrent: boolean
  models: readonly Model[]
  /** What is fitted on the base of the radio, which decides the controls on offer. */
  baseFitting: BaseFitting | null
  dispatch: Dispatch<Action>
  /** True when the person has started to leave with changes not yet saved, so the leave question should be asked. */
  leaving: boolean
  onKeepEditing: () => void
  onLeave: () => void
}

/**
 * One part of a model on a page of its own: the wizard's step for it, filled with the model's
 * answers, and a bar that stays in view with "Save changes" and "Cancel". Saving happens here and
 * nowhere else, one part at a time.
 */
export function EditPartScreen({
  edit,
  model,
  isCurrent,
  models,
  baseFitting,
  dispatch,
  leaving,
  onKeepEditing,
  onLeave,
}: EditPartScreenProps) {
  const problems = problemsInEdit(model, edit.draft, models)
  const Part = partScreens[edit.part]

  function save(event: FormEvent) {
    event.preventDefault()
    if (!partIsFine(edit.part, problems)) {
      dispatch({ type: 'editTried' })
      return
    }
    // The address is changed first, so the page and the state never disagree for a moment.
    goTo(paths.editModel(model.id))
    dispatch({ type: 'editSaved' })
  }

  return (
    <EditFrame model={model} isCurrent={isCurrent}>
      <form className={styles.form} onSubmit={save} noValidate>
        <Part
          draft={edit.draft}
          view={edit.view}
          problems={problems}
          tried={edit.tried}
          // A model may keep its own name, so that one is not in the way.
          namesInUse={models.filter((other) => other.id !== model.id).map((other) => other.name)}
          baseFitting={baseFitting}
          editing={{ model }}
          onChange={(draft) => dispatch({ type: 'editChanged', draft })}
          onViewChange={(view) => dispatch({ type: 'editChanged', view })}
          onExtraPicked={(kind) => dispatch({ type: 'editExtraPicked', kind })}
          onExtraRemoved={(id) => dispatch({ type: 'editExtraRemoved', id })}
          onExtraChanged={(id, answers) => dispatch({ type: 'editExtraChanged', id, answers })}
        />

        <div className={wizardStyles.actions} data-sticks-to-window>
          <Button type="submit" variant="primary">
            {text.save}
          </Button>
          {/* Cancel goes back to the model. With changes not yet saved, that asks first. */}
          <ButtonLink href={paths.editModel(model.id)}>{text.cancel}</ButtonLink>
        </div>
      </form>

      {leaving && (
        <Dialog title={text.leave.title} onDismiss={onKeepEditing}>
          <p>{text.leave.body(model.name)}</p>
          <DialogActions>
            <Button variant="primary" onClick={onKeepEditing} data-autofocus>
              {text.leave.keepEditing}
            </Button>
            <Button onClick={onLeave}>{text.leave.leave}</Button>
          </DialogActions>
        </Dialog>
      )}
    </EditFrame>
  )
}
