import { useEffect, type Dispatch, type FormEvent } from 'react'
import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { BackIcon, PlusIcon } from '../../components/icons.tsx'
import type { Model } from '../../domain/model.ts'
import type { BaseFitting } from '../../domain/radio.ts'
import type { Action } from '../../state/appState.ts'
import { goTo, paths, redirectTo } from '../../state/useHashRoute.ts'
import {
  problemsIn,
  stepAfter,
  stepBefore,
  stepBlocking,
  stepIsFine,
  type BuiltStepId,
  type WizardState,
} from '../../state/wizard.ts'
import { strings } from '../../strings/en.ts'
import styles from './AddModelScreen.module.css'
import { NameStep } from './NameStep.tsx'
import { ExtrasStep } from './ExtrasStep.tsx'
import { FeedbackStep } from './FeedbackStep.tsx'
import { ReceiverStep } from './ReceiverStep.tsx'
import { ReviewStep } from './ReviewStep.tsx'
import { SteeringThrottleStep } from './SteeringThrottleStep.tsx'
import type { StepProps } from './stepProps.ts'
import { WizardFrame } from './WizardFrame.tsx'

interface AddModelScreenProps {
  wizard: WizardState
  /** The step to show. The page address decides it. */
  step: BuiltStepId
  /** The models already on the radio. Nothing here changes them. */
  models: readonly Model[]
  /** What is fitted on the base of the radio, which decides the controls on offer. */
  baseFitting: BaseFitting | null
  dispatch: Dispatch<Action>
  /** True when the person has started to leave, so the leave question should be asked. */
  leaving: boolean
  onKeepGoing: () => void
  onLeave: () => void
  /** Called with every answer in, when the person chooses "Add to my radio". */
  onFinished: () => void
}

const text = strings.addModel

const stepScreens: Record<BuiltStepId, (props: StepProps) => React.ReactNode> = {
  name: NameStep,
  receiver: ReceiverStep,
  steeringThrottle: SteeringThrottleStep,
  extras: ExtrasStep,
  feedback: FeedbackStep,
  review: ReviewStep,
}

/**
 * The "Add a model" wizard: one page under the header, one step at a time. The answers are kept
 * in the app's state, and nothing changes in the list of models until the last button.
 */
export function AddModelScreen({
  wizard,
  step,
  models,
  baseFitting,
  dispatch,
  leaving,
  onKeepGoing,
  onLeave,
  onFinished,
}: AddModelScreenProps) {
  const problems = problemsIn(wizard.draft, models)

  // A later step cannot be shown while an earlier one still needs an answer.
  const blocking = leaving ? null : stepBlocking(step, problems)
  const shown = blocking ?? step
  useEffect(() => {
    if (!blocking) return
    dispatch({ type: 'wizardStepTried', step: blocking })
    redirectTo(paths.addStep(blocking))
  }, [blocking, dispatch])

  const before = stepBefore(shown)
  const after = stepAfter(shown)
  const Step = stepScreens[shown]

  function next(event: FormEvent) {
    event.preventDefault()
    if (!stepIsFine(shown, problems)) {
      dispatch({ type: 'wizardStepTried', step: shown })
    } else if (after) {
      goTo(paths.addStep(after))
    } else {
      onFinished()
    }
  }

  return (
    <WizardFrame shown={shown} where={text.goesIn(wizard.draft.position)}>
      <form className={styles.form} onSubmit={next} noValidate>
        <Step
          draft={wizard.draft}
          view={wizard.view}
          problems={problems}
          tried={wizard.tried.includes(shown)}
          namesInUse={models.map((model) => model.name)}
          baseFitting={baseFitting}
          onChange={(draft) => dispatch({ type: 'wizardChanged', draft })}
          onViewChange={(view) => dispatch({ type: 'wizardChanged', view })}
          onExtraPicked={(kind) => dispatch({ type: 'wizardExtraPicked', kind })}
          onExtraRemoved={(id) => dispatch({ type: 'wizardExtraRemoved', id })}
          onExtraChanged={(id, answers) => dispatch({ type: 'wizardExtraChanged', id, answers })}
        />

        <div className={styles.actions} data-sticks-to-window>
          {/* Back from the first step leaves the wizard, so it asks first, like every other way out. */}
          <Button icon={<BackIcon />} onClick={() => goTo(before ? paths.addStep(before) : paths.home)}>
            {text.back}
          </Button>
          {after ? (
            <Button type="submit" variant="primary">
              {text.next}
            </Button>
          ) : (
            <Button type="submit" variant="primary" icon={<PlusIcon />}>
              {text.review.confirm}
            </Button>
          )}
          <a className={styles.cancel} href={paths.home}>
            {text.cancel}
          </a>
        </div>
      </form>

      {leaving && (
        <Dialog title={text.leave.title} onDismiss={onKeepGoing}>
          <p>{text.leave.body}</p>
          <DialogActions>
            <Button variant="primary" onClick={onKeepGoing} data-autofocus>
              {text.leave.keepGoing}
            </Button>
            <Button onClick={onLeave}>{text.leave.leave}</Button>
          </DialogActions>
        </Dialog>
      )}
    </WizardFrame>
  )
}
