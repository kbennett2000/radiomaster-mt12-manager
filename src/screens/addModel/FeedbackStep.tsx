import { useId } from 'react'
import { ColourDot, Pills } from '../../components/Pills.tsx'
import { LIGHT_COLOURS, type LightColour } from '../../domain/catalog.ts'
import { switches, type ExtraAnswers } from '../../domain/extras.ts'
import type { ExtraFeedback, FeedbackSound } from '../../domain/model.ts'
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

interface RowProps {
  extra: ExtraAnswers
  onChange: (feedback: ExtraFeedback) => void
}

/** What the radio does each time one extra switches: a sound, a buzz, and a light colour while it is on. */
function FeedbackRow({ extra, onChange }: RowProps) {
  const name = extraName(extra)
  const feedback = extra.feedback
  const colourId = useId()

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
        <div className={styles.setting}>
          <label className={styles.settingLabel} htmlFor={colourId}>
            {text.colourWhileOn}
          </label>
          <div className={styles.colourPicker}>
            <ColourDot colour={feedback.lightColour} />
            <select
              id={colourId}
              className={styles.select}
              value={toChoice(feedback.lightColour)}
              onChange={(event) =>
                onChange({ ...feedback, lightColour: fromChoice(event.target.value as ColourChoice) })
              }
              aria-label={text.settingFor(text.colourWhileOn, name)}
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
      </div>
    </li>
  )
}

/**
 * Step 5: how the radio tells the driver what is happening. Everything starts off, and the step
 * can be skipped.
 */
export function FeedbackStep({ draft, onChange, onExtraChanged }: StepProps) {
  const modelColourId = useId()
  const modelColourHelpId = useId()
  const rows = draft.extras.filter(switches)
  const coloured = rows.filter((extra) => extra.feedback.lightColour !== null)

  return (
    <div className={stepStyles.step}>
      <div>
        <h2>{text.question}</h2>
        <p className={stepStyles.intro}>{text.help}</p>
      </div>

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
            {/* Two extras cannot both colour the lights at once, so say which one wins. */}
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
