// A model summed up three ways: its answers row by row, what each control does, and what plugs
// into each receiver port. The wizard's "Check it over" page shows these for a model about to be
// added, and the Edit page shows them for one that is already on the radio.

import type { MouseEventHandler, ReactNode } from 'react'
import { colourStatesOf, switches, type ExtraAnswers } from '../../domain/extras.ts'
import { coloursIn, givesFeedback } from '../../domain/feedback.ts'
import type { Feature } from '../../domain/model.ts'
import type { BaseFitting } from '../../domain/radio.ts'
import type { EditPart } from '../../state/edit.ts'
import { throttleFeelOf, type ModelDraft } from '../../state/wizard.ts'
import { listOf, strings } from '../../strings/en.ts'
import { extraName, whatEachControlDoes, whatPlugsIn } from './describe.ts'
import styles from './ReviewStep.module.css'

const text = strings.addModel.review

/** Where a "Change" link goes, and anything to do on the way there. */
export interface ChangeLink {
  href: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

interface RowProps {
  label: string
  /** The way to change this answer. Left out for the position, which is not changed here. */
  change?: ChangeLink
  /** Words that stand where "Change" would, for an answer that is changed somewhere else. */
  note?: string
  children: ReactNode
}

function Row({ label, change, note, children }: RowProps) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.answer}>{children}</dd>
      <dd className={note ? styles.note : styles.change}>
        {change && (
          <a href={change.href} aria-label={text.changeNamed(label)} onClick={change.onClick}>
            {text.change}
          </a>
        )}
        {note}
      </dd>
    </div>
  )
}

/**
 * One extra's feedback in a few words, such as "Lights: beep, vibration and blue light". An extra
 * with a colour for each state names each one: "blue light in low gear and green light in high gear".
 */
function feedbackWords(extra: ExtraAnswers): string {
  const { sound, vibration } = extra.feedback
  const parts = [
    sound === 'off' ? null : text.feedbackSound[sound],
    vibration ? text.feedbackVibration : null,
    ...coloursIn(extra.feedback, colourStatesOf(extra)).map(({ state, colour }) =>
      text.feedbackColour(strings.addModel.feedback.colours[colour], state),
    ),
  ].filter((part) => part !== null)
  return text.extraFeedback(extraName(extra), listOf(parts))
}

interface ModelSummaryProps {
  /** The model's answers. */
  draft: ModelDraft
  /** Where "Change" goes for a part of the model. `extraId` is given for an extra's own row. */
  changeLink: (part: EditPart, extraId?: string) => ChangeLink
  /** Said on the Position row in place of "Change". */
  positionNote?: string
  /** A way to add or remove extras, shown under the extras. With it, "Extras: None" needs no "Change" of its own. */
  extrasLink?: ReactNode
  /** Feedback the model has that these answers do not cover, said first on the Radio feedback row. */
  otherFeedback?: string | null
}

/** Every answer, one row each, with a way to change it. */
export function ModelSummary({ draft, changeLink, positionNote, extrasLink, otherFeedback }: ModelSummaryProps) {
  const withFeedback = draft.extras.filter((extra) => switches(extra) && givesFeedback(extra.feedback))
  const noFeedback = draft.lightColour === null && withFeedback.length === 0 && !otherFeedback

  return (
    <dl className={styles.summary}>
      <Row label={text.rows.name} change={changeLink('name')}>
        {draft.name.trim()}
      </Row>
      <Row label={text.rows.position} note={positionNote}>
        {draft.position}
      </Row>
      <Row label={text.rows.receiver} change={changeLink('receiver')}>
        {draft.receiverTypeId ? strings.receiverTypes[draft.receiverTypeId] : null}
      </Row>
      <Row label={text.rows.steering} change={changeLink('steeringThrottle')}>
        <span>{text.direction[draft.steeringDirection]}</span>
        <span>{text.travel(draft.steeringTravel, draft.vehicleKind)}</span>
      </Row>
      <Row label={text.rows.throttle} change={changeLink('steeringThrottle')}>
        <span>{text.direction[draft.throttleDirection]}</span>
        <span>{text.feel[throttleFeelOf(draft)]}</span>
        <span>{text.topSpeed(draft.topSpeed)}</span>
      </Row>
      {draft.extras.length === 0 && (
        <Row label={text.extrasLabel} change={extrasLink ? undefined : changeLink('extras')}>
          {extrasLink ? <span className={styles.stacked}>{text.extrasNone}</span> : text.extrasNone}
          {extrasLink && <span className={styles.underAnswer}>{extrasLink}</span>}
        </Row>
      )}
      {/* "Change" beside an extra opens that extra's own questions, not the folded list. */}
      {draft.extras.map((extra) => (
        <Row key={extra.id} label={extraName(extra)} change={changeLink('extras', extra.id)}>
          {extra.control && <span>{strings.controls[extra.control]}</span>}
          {extra.speedControl && <span>{strings.controls[extra.speedControl]}</span>}
          {extra.port !== null && <span>{text.port(extra.port)}</span>}
        </Row>
      ))}
      {draft.extras.length > 0 && extrasLink && (
        <div className={styles.linkRow}>
          <dt className="visually-hidden">{text.extrasLabel}</dt>
          <dd className={styles.linkCell}>{extrasLink}</dd>
        </div>
      )}
      <Row label={text.feedbackLabel} change={changeLink('feedback')}>
        {noFeedback && text.feedbackNone}
        {otherFeedback && <span>{otherFeedback}</span>}
        {draft.lightColour !== null && (
          <span>{text.modelColour(strings.addModel.feedback.colours[draft.lightColour])}</span>
        )}
        {withFeedback.map((extra) => (
          <span key={extra.id}>{feedbackWords(extra)}</span>
        ))}
      </Row>
    </dl>
  )
}

interface SectionProps {
  /** The level of the section's heading, which depends on the page it sits on. */
  heading: 'h2' | 'h3'
}

/** Every control on the radio, with what each does on the model. */
export function ControlsSection({
  features,
  baseFitting,
  heading: Heading,
}: SectionProps & { features: readonly Feature[]; baseFitting: BaseFitting | null }) {
  return (
    <section className={styles.section}>
      <Heading className={styles.sectionTitle}>{text.controlsTitle}</Heading>
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
  )
}

/** Every receiver port, with what plugs into it on the model. */
export function PortsSection({ features, heading: Heading }: SectionProps & { features: readonly Feature[] }) {
  return (
    <section className={styles.section}>
      <Heading className={styles.sectionTitle}>{text.portsTitle}</Heading>
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
  )
}
