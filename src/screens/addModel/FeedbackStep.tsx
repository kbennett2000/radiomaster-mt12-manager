import { useId } from 'react'
import { ColourDot, Pills } from '../../components/Pills.tsx'
import { LIGHT_COLOURS, type LightColour } from '../../domain/catalog.ts'
import { colourStatesOf, switches, type ExtraAnswers } from '../../domain/extras.ts'
import { colourFor, setsAColour, withColourFor } from '../../domain/feedback.ts'
import type { ExtraFeedback, ExtraState, FeedbackSound } from '../../domain/model.ts'
import { strings } from '../../strings/en.ts'
import { extraName, voiceWords } from './describe.ts'
import styles from './FeedbackStep.module.css'
import type { StepProps } from './stepProps.ts'
import stepStyles from './steps.module.css'

const text = strings.addModel.feedback

const sounds: readonly FeedbackSound[] = ['off', 'beep', 'voice']

// "No colour" needs a value of its own in a list of choices.
type ColourChoice = LightColour | 'none'
const toChoice = (colour: LightColour | null): ColourChoice => colour ?? 'none'
const fromChoice = (choice: ColourChoice): LightColour | null => (choice === 'none' ? null : choice)

interface ColourProps {
  /** The state of the extra this colour is for. */
  state: ExtraState
  /** The extra's name, so a screen reader hears which row the choice belongs to. */
  extraName: string
  value: LightColour | null
  onChange: (colour: LightColour | null) => void
}

/** The colour the radio's lights show in one state of an extra. It starts on None. */
function ColourSetting({ state, extraName: name, value, onChange }: ColourProps) {
  const id = useId()
  return (
    <div className={styles.setting}>
      <p className={styles.settingLabel}>
        <label htmlFor={id}>{text.colourFor[state]}</label>
        {/* Neutral is passed through on the way between gears, so most people leave it alone. */}
        {state === 'neutral' && <span className={styles.optional}>{text.optional}</span>}
      </p>
      <div className={styles.colourPicker}>
        <ColourDot colour={value} />
        <select
          id={id}
          className={styles.select}
          value={toChoice(value)}
          onChange={(event) => onChange(fromChoice(event.target.value as ColourChoice))}
          aria-label={text.settingFor(text.colourFor[state], name)}
        >
          <option value="none">{text.none}</option>
          {LIGHT_COLOURS.map((colour) => (
            <option key={colour} value={colour}>
              {text.colours[colour]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

interface RowProps {
  extra: ExtraAnswers
  onChange: (feedback: ExtraFeedback) => void
}

/**
 * What the radio does each time one extra switches: a sound, a buzz, and a light colour. An extra
 * that is only on or off has one colour, for while it is on. One with more states, such as a
 * 2-speed transmission, has a colour for each, on a line of their own.
 */
function FeedbackRow({ extra, onChange }: RowProps) {
  const name = extraName(extra)
  const feedback = extra.feedback
  const states = colourStatesOf(extra)
  const colours = states.map((state) => (
    <ColourSetting
      key={state}
      state={state}
      extraName={name}
      value={colourFor(feedback, state)}
      onChange={(colour) => onChange(withColourFor(feedback, states, state, colour))}
    />
  ))

  return (
    <li className={styles.row}>
      <h4 className={styles.rowName}>{name}</h4>
      <div className={styles.settings}>
        <div className={styles.setting}>
          <p className={styles.settingLabel}>{text.sound}</p>
          <Pills
            label={text.settingFor(text.sound, name)}
            options={sounds.map((value) => ({ value, label: text.sounds[value] }))}
            value={feedback.sound}
            onChange={(sound) => onChange({ ...feedback, sound })}
          />
          {/*
            The words Voice would say. Saying them will later need sound files put on the radio's
            SD card. Nothing here makes or copies those files yet.
          */}
          <p className={styles.says} role="status">
            {feedback.sound === 'voice' ? text.says(voiceWords(extra)) : null}
          </p>
        </div>
        <div className={styles.setting}>
          <p className={styles.settingLabel}>{text.vibration}</p>
          <Pills
            label={text.settingFor(text.vibration, name)}
            options={[
              { value: 'off', label: text.vibrationOff },
              { value: 'on', label: text.vibrationOn },
            ]}
            value={feedback.vibration ? 'on' : 'off'}
            onChange={(vibration) => onChange({ ...feedback, vibration: vibration === 'on' })}
          />
        </div>
        {states.length === 1 && colours}
      </div>
      {states.length > 1 && <div className={styles.settings}>{colours}</div>}
    </li>
  )
}

/**
 * Step 5: how the radio tells the driver what is happening. Everything starts off, and the step
 * can be skipped.
 */
export function FeedbackStep({ draft, editing, onChange, onExtraChanged }: StepProps) {
  const modelColourId = useId()
  const modelColourHelpId = useId()
  const rows = draft.extras.filter(switches)
  const coloured = rows.filter((extra) => setsAColour(extra.feedback))

  return (
    <div className={stepStyles.step}>
      <div>
        <h2>{text.question}</h2>
        <p className={stepStyles.intro}>{text.help}</p>
      </div>

      {/* Feedback set for the whole model can only be made on the radio. */}
      {editing && editing.model.feedback.length > 0 && (
        <p className={styles.clash}>{strings.editModel.leftAlone.feedbackAlso}</p>
      )}

      <section className={styles.section}>
        <h3 id={modelColourId}>{text.modelColour}</h3>
        <p id={modelColourHelpId} className={styles.help}>
          {text.modelColourHelp}
        </p>
        <Pills
          labelledBy={modelColourId}
          describedBy={modelColourHelpId}
          options={[
            { value: 'none', label: text.dontChange },
            ...LIGHT_COLOURS.map((colour) => ({ value: colour, label: text.colours[colour], dot: colour })),
          ]}
          value={toChoice(draft.lightColour)}
          onChange={(choice: ColourChoice) => onChange({ lightColour: fromChoice(choice) })}
        />
      </section>

      <section className={styles.section}>
        <h3>{text.extrasTitle}</h3>
        {rows.length === 0 ? (
          <p className={styles.help}>{text.nothingSwitches}</p>
        ) : (
          <>
            <p className={styles.help}>{text.extrasHelp}</p>
            {/* The lights show one colour at a time, so say which row wins when two would set it. */}
            <p className={styles.clash} role="status">
              {coloured.length >= 2 ? text.clash : null}
            </p>
            <ul className={styles.rows}>
              {rows.map((extra) => (
                <FeedbackRow
                  key={extra.id}
                  extra={extra}
                  onChange={(feedback) => onExtraChanged(extra.id, { feedback })}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
