import type { ReactNode } from 'react'
import { CheckIcon } from '../../components/icons.tsx'
import { WIZARD_STEPS, type WizardStepId } from '../../state/wizard.ts'
import { strings } from '../../strings/en.ts'
import styles from './AddModelScreen.module.css'

const text = strings.addModel

/** Where a step stands compared with the one on screen. */
type StepStanding = 'done' | 'current' | 'ahead'

function standingOf(step: WizardStepId, shown: WizardStepId): StepStanding {
  if (step === shown) return 'current'
  return WIZARD_STEPS.indexOf(step) < WIZARD_STEPS.indexOf(shown) ? 'done' : 'ahead'
}

/** All seven steps by name, with where the person is. It shows the way; it is not a way to jump about. */
function Progress({ shown }: { shown: WizardStepId }) {
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
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

interface WizardFrameProps {
  /** The step that is showing. */
  shown: WizardStepId
  /** The quiet line beside the title: where the model will go, or where it went. */
  where: string
  children: ReactNode
}

/** What every page of the wizard shares: the title, the quiet line beside it, and the list of steps. */
export function WizardFrame({ shown, where, children }: WizardFrameProps) {
  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1>{text.title}</h1>
        <p className={styles.where}>{where}</p>
      </div>
      <div className={styles.columns}>
        <Progress shown={shown} />
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
