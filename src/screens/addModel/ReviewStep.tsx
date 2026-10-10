import type { ReactNode } from 'react'
import { throttleFeelOf, type BuiltStepId } from '../../state/wizard.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './ReviewStep.module.css'
import type { StepProps } from './stepProps.ts'
import stepStyles from './steps.module.css'

const text = strings.addModel.review

interface RowProps {
  label: string
  /** The step where this answer can be changed. Left out for the position, which no step sets. */
  changeOn?: BuiltStepId
  children: ReactNode
}

function Row({ label, changeOn, children }: RowProps) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.answer}>{children}</dd>
      <dd className={styles.change}>
        {changeOn && (
          <a href={paths.addStep(changeOn)} aria-label={text.changeNamed(label)}>
            {text.change}
          </a>
        )}
      </dd>
    </div>
  )
}

/** Step 6, in its simple form for now: everything that was answered, with a way back to each step. */
export function ReviewStep({ draft }: StepProps) {
  return (
    <div className={stepStyles.step}>
      <h2>{text.title}</h2>
      <dl className={styles.summary}>
        <Row label={text.rows.name} changeOn="name">
          {draft.name.trim()}
        </Row>
        <Row label={text.rows.position}>{draft.position}</Row>
        <Row label={text.rows.receiver} changeOn="receiver">
          {draft.receiverTypeId ? strings.receiverTypes[draft.receiverTypeId] : null}
        </Row>
        <Row label={text.rows.steering} changeOn="steeringThrottle">
          <span>{text.direction[draft.steeringDirection]}</span>
          <span>{text.travel(draft.steeringTravel)}</span>
        </Row>
        <Row label={text.rows.throttle} changeOn="steeringThrottle">
          <span>{text.direction[draft.throttleDirection]}</span>
          <span>{text.feel[throttleFeelOf(draft)]}</span>
          <span>{text.topSpeed(draft.topSpeed)}</span>
        </Row>
      </dl>
      <p className={styles.comingNext}>{text.comingNext}</p>
    </div>
  )
}
