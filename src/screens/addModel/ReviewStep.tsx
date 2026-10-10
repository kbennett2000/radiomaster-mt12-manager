import type { ReactNode } from 'react'
import { switches, type ExtraAnswers } from '../../domain/extras.ts'
import { givesFeedback } from '../../domain/feedback.ts'
import { paths } from '../../state/useHashRoute.ts'
import { modelFrom, throttleFeelOf, type BuiltStepId } from '../../state/wizard.ts'
import { listOf, strings } from '../../strings/en.ts'
import { extraName, whatEachControlDoes, whatPlugsIn } from './describe.ts'
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

/** One extra's feedback in a few words, such as "Lights: beep, vibration and blue light". */
function feedbackWords(extra: ExtraAnswers): string {
  const { sound, vibration, lightColour } = extra.feedback
  const parts = [
    sound === 'off' ? null : text.feedbackSound[sound],
    vibration ? text.feedbackVibration : null,
    lightColour ? text.feedbackColour(strings.addModel.feedback.colours[lightColour]) : null,
  ].filter((part) => part !== null)
  return text.extraFeedback(extraName(extra), listOf(parts))
}

/**
 * Step 6: everything that was answered, with a way back to each step. Below the summary it turns
 * the answers round two ways: what each control on the radio does, and what plugs into each
 * receiver port.
 */
export function ReviewStep({ draft, baseFitting }: StepProps) {
  // The same model "Add to my radio" will add, built here only to describe it.
  const features = modelFrom(draft, 'review', draft.position)?.features ?? []
  const withFeedback = draft.extras.filter((extra) => switches(extra) && givesFeedback(extra.feedback))

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
          <span>{text.travel(draft.steeringTravel, draft.vehicleKind)}</span>
        </Row>
        <Row label={text.rows.throttle} changeOn="steeringThrottle">
          <span>{text.direction[draft.throttleDirection]}</span>
          <span>{text.feel[throttleFeelOf(draft)]}</span>
          <span>{text.topSpeed(draft.topSpeed)}</span>
        </Row>
        {draft.extras.length === 0 && (
          <Row label={text.extrasLabel} changeOn="extras">
            {text.extrasNone}
          </Row>
        )}
        {draft.extras.map((extra) => (
          <Row key={extra.id} label={extraName(extra)} changeOn="extras">
            {extra.control && <span>{strings.controls[extra.control]}</span>}
            {extra.speedControl && <span>{strings.controls[extra.speedControl]}</span>}
            {extra.port !== null && <span>{text.port(extra.port)}</span>}
          </Row>
        ))}
        <Row label={text.feedbackLabel} changeOn="feedback">
          {draft.lightColour === null && withFeedback.length === 0 && text.feedbackNone}
          {draft.lightColour !== null && (
            <span>{text.modelColour(strings.addModel.feedback.colours[draft.lightColour])}</span>
          )}
          {withFeedback.map((extra) => (
            <span key={extra.id}>{feedbackWords(extra)}</span>
          ))}
        </Row>
      </dl>

      <section className={styles.section}>
        <h3>{text.controlsTitle}</h3>
        <p className={styles.help}>{text.controlsHelp}</p>
        <dl className={styles.lines}>
          {whatEachControlDoes(features, baseFitting).map(({ control, does }) => (
            <div key={control} className={styles.line}>
              <dt className={styles.lineLabel}>{strings.controls[control]}</dt>
              <dd className={does ? styles.lineWords : styles.unused}>{does ?? text.notUsed}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section}>
        <h3>{text.portsTitle}</h3>
        <p className={styles.help}>{text.portsHelp}</p>
        <dl className={styles.lines}>
          {whatPlugsIn(features).map(({ port, what }) => (
            <div key={port} className={styles.line}>
              <dt className={styles.lineLabel}>{text.port(port)}</dt>
              <dd className={what ? styles.lineWords : styles.unused}>{what ?? text.nothing}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className={styles.afterThis}>{text.afterThis}</p>
    </div>
  )
}
