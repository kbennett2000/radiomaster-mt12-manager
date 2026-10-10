import { useId } from 'react'
import { Button } from '../../components/Button.tsx'
import { RadioChoices } from '../../components/Choices.tsx'
import { PlusIcon } from '../../components/icons.tsx'
import { controlKind, gyroGainPortFor } from '../../domain/catalog.ts'
import {
  controlChoices,
  EXTRA_KINDS,
  EXTRAS,
  MAX_EXTRA_NAME_LENGTH,
  portChoices,
  problemsInExtra,
  rolesOf,
  workingOf,
  type ControlRole,
  type ExtraAnswers,
  type ExtraKind,
  type ExtraProblem,
  type PortUser,
} from '../../domain/extras.ts'
import type { CustomWorks, SwitchPosition } from '../../domain/model.ts'
import { basicPortsOf, COMMON_ON_CRAWLERS } from '../../state/wizard.ts'
import { strings } from '../../strings/en.ts'
import { extraName, howExtraWorks } from './describe.ts'
import styles from './ExtrasStep.module.css'
import type { StepProps } from './stepProps.ts'
import stepStyles from './steps.module.css'

const text = strings.addModel.extras

const positions: readonly SwitchPosition[] = ['up', 'middle', 'down']
const waysOfWorking: readonly CustomWorks[] = ['onOff', 'threePositions', 'dial']

/** The words for something still missing from an extra. */
function problemWords(problem: ExtraProblem, extra: ExtraAnswers): string {
  if (problem === 'nameTooLong') return text.problems.nameTooLong(extra.name.trim().length, MAX_EXTRA_NAME_LENGTH)
  return text.problems[problem]
}

const portUserName = (user: PortUser): string => (user.what === 'extra' ? extraName(user.extra) : strings.features[user.what])

/** What one extra's questions need to know about the rest of the model. */
interface Around {
  /** Every extra picked so far, this one included. */
  extras: readonly ExtraAnswers[]
  /** True once the person has tried to move on. Missing answers are only pointed out then. */
  tried: boolean
  onChange: (answers: Partial<ExtraAnswers>) => void
}

/** "What is it called?" for a "Something else". The name is checked as the person types. */
function NameQuestion({ extra, tried, onChange }: Around & { extra: ExtraAnswers }) {
  const fieldId = useId()
  const hintId = useId()
  const problemId = useId()
  const used = extra.name.trim().length
  const tooLong = used > MAX_EXTRA_NAME_LENGTH
  const problem = tooLong ? 'nameTooLong' : tried && used === 0 ? 'nameMissing' : null

  return (
    <div>
      <label className={styles.fieldLabel} htmlFor={fieldId}>
        {text.nameLabel}
      </label>
      <p id={hintId} className={styles.hint}>
        {text.nameHint(MAX_EXTRA_NAME_LENGTH)}
      </p>
      <input
        id={fieldId}
        className={styles.nameField}
        type="text"
        value={extra.name}
        onChange={(event) => onChange({ name: event.target.value })}
        aria-describedby={`${hintId} ${problemId}`}
        aria-invalid={problem ? true : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <div className={styles.below}>
        <p id={problemId} className={stepStyles.problem} role="alert">
          {problem ? problemWords(problem, extra) : null}
        </p>
        <p className={tooLong ? `${styles.count} ${styles.over}` : styles.count}>
          {text.nameCount(used, MAX_EXTRA_NAME_LENGTH)}
        </p>
      </div>
    </div>
  )
}

interface ControlQuestionProps extends Around {
  extra: ExtraAnswers
  role: ControlRole
  baseFitting: StepProps['baseFitting']
}

/**
 * "Which control works it?" Only the kinds of control that make sense are offered. A control
 * another extra uses is shown greyed, with what uses it.
 */
function ControlQuestion({ extra, role, extras, baseFitting, tried, onChange }: ControlQuestionProps) {
  // One decision at a time: a "Something else" is asked for its control once it has said how it works.
  if (!workingOf(extra, role)) return null
  const choices = controlChoices(extra, role, extras, baseFitting)
  const value = role === 'speed' ? extra.speedControl : extra.control

  let question: string = text.controlQuestion
  if (extra.kind === 'cruiseControl') question = role === 'speed' ? text.cruiseSpeedQuestion : text.cruiseOnOffQuestion

  // Running out is said at once, not only after Next: there is nothing to pick until one is freed.
  let problem: string | null = null
  if (value === null && choices.every((choice) => choice.takenBy)) {
    problem = choices.every((choice) => choice.control.kind === 'dial') ? text.noDialFree : text.noControlFree
  } else if (value === null && tried) {
    problem = text.problems[role === 'speed' ? 'speedControlMissing' : 'controlMissing']
  }

  return (
    <RadioChoices
      question={question}
      size="field"
      layout="grid"
      options={choices.map(({ control, takenBy }) => ({
        value: control.id,
        label: strings.controls[control.id],
        note: strings.controlKinds[control.kind],
        unavailable: takenBy ? text.usedBy(extraName(takenBy)) : undefined,
      }))}
      value={value}
      onChange={(control) => onChange(role === 'speed' ? { speedControl: control } : { control })}
      problem={problem}
    />
  )
}

interface QuestionsProps extends Around {
  extra: ExtraAnswers
  baseFitting: StepProps['baseFitting']
  draft: StepProps['draft']
  onDone: () => void
}

/** The questions for one extra, shown right under it while it is the one being answered. */
function ExtraQuestions({ extra, extras, baseFitting, draft, tried, onChange, onDone }: QuestionsProps) {
  const around: Around = { extras, tried, onChange }
  const working = workingOf(extra)
  const onSwitch = extra.control !== null && controlKind(extra.control) === 'switch3'
  const ports = portChoices(extra, extras, basicPortsOf(draft))
  const gyroPort = extra.kind === 'gyroGain' ? gyroGainPortFor(draft.receiverTypeId) : null

  let portProblem: string | null = null
  if (extra.port === null && ports.every((choice) => choice.takenBy)) portProblem = text.noPortFree
  else if (extra.port === null && tried) portProblem = text.problems.portMissing

  return (
    <div className={styles.questions}>
      {extra.kind === 'customExtra' && (
        <>
          <NameQuestion extra={extra} {...around} />
          <RadioChoices
            question={text.worksQuestion}
            size="field"
            layout="grid"
            options={waysOfWorking.map((way) => ({ value: way, ...text.works[way] }))}
            value={extra.works}
            onChange={(works) => onChange({ works })}
            problem={tried && !extra.works ? text.problems.worksMissing : null}
          />
        </>
      )}

      {rolesOf(extra.kind).map((role) => (
        <div key={role} className={styles.controlBlock}>
          <ControlQuestion extra={extra} role={role} baseFitting={baseFitting} {...around} />

          {role === 'main' && onSwitch && working === 'onOff' && (
            <RadioChoices
              question={extra.kind === 'throttleSafetyLock' ? text.lockPositionQuestion : text.positionQuestion}
              size="field"
              layout="row"
              options={positions.map((position) => ({ value: position, label: text.positions[position] }))}
              value={extra.onPosition}
              onChange={(onPosition) => onChange({ onPosition })}
            />
          )}

          {role === 'main' && onSwitch && working === 'twoSpeed' && (
            <label className={styles.swap}>
              <input
                type="checkbox"
                className={styles.check}
                checked={extra.swapped}
                onChange={(event) => onChange({ swapped: event.target.checked })}
              />
              <span>{text.swap}</span>
            </label>
          )}

          {/* One sentence on how it will work, as soon as a control is picked. */}
          <p className={styles.how} role="status">
            {howExtraWorks(extra, role)}
          </p>
        </div>
      ))}

      {EXTRAS[extra.kind].usesPort && (
        <RadioChoices
          question={text.portQuestion}
          size="field"
          layout="grid"
          help={gyroPort === null ? undefined : text.gyroHint(gyroPort)}
          options={ports.map(({ port, takenBy }) => ({
            value: String(port),
            label: text.port(port),
            unavailable: takenBy ? text.usedBy(portUserName(takenBy)) : undefined,
          }))}
          value={extra.port === null ? null : String(extra.port)}
          onChange={(port) => onChange({ port: Number(port) })}
          problem={portProblem}
        />
      )}

      <div>
        <Button size="small" onClick={onDone}>
          {text.done}
        </Button>
      </div>
    </div>
  )
}

interface SummaryProps {
  extra: ExtraAnswers
  tried: boolean
  onOpen: () => void
}

/** An answered extra, folded down to one line: its control, its port, and how it works. */
function ExtraSummary({ extra, tried, onOpen }: SummaryProps) {
  const missing = problemsInExtra(extra)
  const facts = [
    extra.control ? strings.controls[extra.control] : null,
    extra.speedControl ? strings.controls[extra.speedControl] : null,
    extra.port === null ? null : text.summaryPort(extra.port),
  ].filter((fact) => fact !== null)
  const sentences = rolesOf(extra.kind).flatMap((role) => howExtraWorks(extra, role) ?? [])

  return (
    <div className={styles.summary}>
      <p className={styles.summaryWords}>
        {facts.length > 0 && <span className={styles.facts}>{facts.join(' · ')}</span>}
        {missing.length === 0 ? (
          <span className={styles.sentences}>{sentences.join(' ')}</span>
        ) : (
          <span className={tried ? stepStyles.problem : styles.unfinished}>
            {text.notFinished} {problemWords(missing[0], extra)}
          </span>
        )}
      </p>
      <Button size="small" aria-label={text.changeNamed(extraName(extra))} onClick={onOpen}>
        {text.change}
      </Button>
    </div>
  )
}

interface ItemProps {
  /** What it is called in the list. */
  name: string
  about: string
  picked: boolean
  commonOnCrawlers: boolean
  onToggle: () => void
  /** The questions or the summary, for a picked extra. */
  children?: React.ReactNode
}

/** One line of the list: a tick box with the extra's name and one plain sentence about it. */
function ExtraItem({ name, about, picked, commonOnCrawlers, onToggle, children }: ItemProps) {
  return (
    <li className={styles.item} data-picked={picked || undefined}>
      <label className={styles.head}>
        <input type="checkbox" className={styles.check} checked={picked} onChange={onToggle} />
        <span className={styles.titles}>
          <span className={styles.name}>{name}</span>
          {commonOnCrawlers && <span className={styles.common}>{text.commonOnCrawlers}</span>}
          <span className={styles.about}>{about}</span>
        </span>
      </label>
      {children}
    </li>
  )
}

/**
 * Step 4: what else the vehicle has. Picking an extra opens its questions right under it. Only
 * one extra is open at a time; the others fold down to a summary line, which keeps the step short.
 */
export function ExtrasStep({
  draft,
  view,
  tried,
  baseFitting,
  onViewChange,
  onExtraPicked,
  onExtraRemoved,
  onExtraChanged,
}: StepProps) {
  const isCrawler = draft.vehicleKind === 'crawler'
  const customs = draft.extras.filter((extra) => extra.kind === 'customExtra')

  function detail(extra: ExtraAnswers) {
    return view.openExtraId === extra.id ? (
      <ExtraQuestions
        extra={extra}
        extras={draft.extras}
        baseFitting={baseFitting}
        draft={draft}
        tried={tried}
        onChange={(answers) => onExtraChanged(extra.id, answers)}
        onDone={() => onViewChange({ openExtraId: null })}
      />
    ) : (
      <ExtraSummary extra={extra} tried={tried} onOpen={() => onViewChange({ openExtraId: extra.id })} />
    )
  }

  function item(kind: ExtraKind) {
    const extra = draft.extras.find((candidate) => candidate.kind === kind)
    return (
      <ExtraItem
        key={kind}
        name={strings.features[kind as Exclude<ExtraKind, 'customExtra'>]}
        about={text.about[kind]}
        picked={extra !== undefined}
        commonOnCrawlers={isCrawler && COMMON_ON_CRAWLERS.includes(kind)}
        onToggle={() => (extra ? onExtraRemoved(extra.id) : onExtraPicked(kind))}
      >
        {extra && detail(extra)}
      </ExtraItem>
    )
  }

  return (
    <div className={stepStyles.step}>
      <div>
        <h2>{text.question}</h2>
        <p className={stepStyles.intro}>{text.help}</p>
      </div>

      <ul className={styles.list}>
        {EXTRA_KINDS.filter((kind) => kind !== 'customExtra').map(item)}

        {/* "Something else" can be added more than once, so each one gets a line of its own. */}
        {customs.map((extra) => (
          <ExtraItem
            key={extra.id}
            name={extraName(extra)}
            about={text.about.customExtra}
            picked
            commonOnCrawlers={false}
            onToggle={() => onExtraRemoved(extra.id)}
          >
            {detail(extra)}
          </ExtraItem>
        ))}
        {customs.length === 0 ? (
          <ExtraItem
            name={text.somethingElse}
            about={text.about.customExtra}
            picked={false}
            commonOnCrawlers={false}
            onToggle={() => onExtraPicked('customExtra')}
          />
        ) : (
          <li className={styles.addAnother}>
            <Button size="small" icon={<PlusIcon />} onClick={() => onExtraPicked('customExtra')}>
              {text.addAnother}
            </Button>
          </li>
        )}
      </ul>
    </div>
  )
}
