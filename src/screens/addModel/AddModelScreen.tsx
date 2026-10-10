import { useEffect, type Dispatch, type FormEvent } from 'react'
import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { BackIcon, CheckIcon, PlusIcon } from '../../components/icons.tsx'
import type { Model } from '../../domain/model.ts'
import type { Action } from '../../state/appState.ts'
import { goTo, paths, redirectTo } from '../../state/useHashRoute.ts'
import {
  BUILT_STEPS,
  isBuilt,
  problemsIn,
  stepAfter,
  stepBefore,
  stepBlocking,
  stepIsFine,
  WIZARD_STEPS,
  type BuiltStepId,
  type WizardState,
  type WizardStepId,
} from '../../state/wizard.ts'
import { strings } from '../../strings/en.ts'
import styles from './AddModelScreen.module.css'
import { NameStep } from './NameStep.tsx'
import { ReceiverStep } from './ReceiverStep.tsx'
import { ReviewStep } from './ReviewStep.tsx'
import { SteeringThrottleStep } from './SteeringThrottleStep.tsx'
import type { StepProps } from './stepProps.ts'

interface AddModelScreenProps {
  wizard: WizardState
  /** The step to show. The page address decides it. */
  step: BuiltStepId
  /** The models already on the radio. Nothing here changes them. */
  models: readonly Model[]
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
  review: ReviewStep,
}

/** Where a step stands compared with the one on screen. */
type StepStanding = 'done' | 'current' | 'ahead' | 'later'

function standingOf(step: WizardStepId, shown: BuiltStepId): StepStanding {
  if (!isBuilt(step)) return 'later'
  if (step === shown) return 'current'
  return BUILT_STEPS.indexOf(step) < BUILT_STEPS.indexOf(shown) ? 'done' : 'ahead'
}

/** All seven steps by name, with where the person is. Steps that are not built yet say so. */
function Progress({ shown }: { shown: BuiltStepId }) {
  return (
    <nav className={styles.progress} aria-label={text.stepsLabel}>
      <ol className={styles.steps}>
        {WIZARD_STEPS.map((step, index) => {
          const standing = standingOf(step, shown)
          return (
            <li
              key={step}
              className={styles.stepItem}
              data-standing={standing}
              aria-current={standing === 'current' ? 'step' : undefined}
            >
              <span className={styles.badge} aria-hidden="true">
                {standing === 'done' ? <CheckIcon /> : index + 1}
              </span>
              <span>
                <span className={styles.stepName}>{text.stepNames[step]}</span>
                {standing === 'done' && <span className="visually-hidden"> ({text.done})</span>}
                {standing === 'later' && <span className={styles.later}>{text.comingNext}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * The "Add a model" wizard: one page under the header, one step at a time. The answers are kept
 * in the app's state, and nothing changes in the list of models until the last button.
 */
export function AddModelScreen({
  wizard,
  step,
  models,
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

  // Each step starts at the top of the page.
  useEffect(() => {
    document.documentElement.scrollTop = 0
  }, [shown])

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
    <div className={styles.page}>
      <div className={styles.top}>
        <h1>{text.title}</h1>
        <p className={styles.where}>{text.goesIn(wizard.draft.position)}</p>
      </div>

      <div className={styles.columns}>
        <Progress shown={shown} />

        <form className={styles.form} onSubmit={next} noValidate>
          <Step
            draft={wizard.draft}
            view={wizard.view}
            problems={problems}
            tried={wizard.tried.includes(shown)}
            namesInUse={models.map((model) => model.name)}
            onChange={(draft) => dispatch({ type: 'wizardChanged', draft })}
            onViewChange={(view) => dispatch({ type: 'wizardChanged', view })}
          />

          <div className={styles.actions}>
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
      </div>

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
    </div>
  )
}
