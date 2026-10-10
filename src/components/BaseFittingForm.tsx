import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { MT12 } from '../domain/catalog.ts'
import type { BaseFitting } from '../domain/radio.ts'
import { strings } from '../strings/en.ts'
import styles from './BaseFittingForm.module.css'
import { Button } from './Button.tsx'
import { BaseFittingDrawing } from './drawings.tsx'

interface BaseFittingFormProps {
  /** The answer already on record, or null the first time. */
  initial: BaseFitting | null
  submitLabel: string
  onSubmit: (baseFitting: BaseFitting) => void
  /** A quiet link shown beside the submit button. */
  secondary?: ReactNode
  /** Adds a line saying the answer can be changed later in Radio setup. For the first time it is asked. */
  saysItCanChangeLater?: boolean
}

/** Asks what is fitted on the base of the radio, with three picture choices. */
export function BaseFittingForm({
  initial,
  submitLabel,
  onSubmit,
  secondary,
  saysItCanChangeLater = false,
}: BaseFittingFormProps) {
  const [chosen, setChosen] = useState<BaseFitting | null>(initial)
  const [triedWithoutChoosing, setTriedWithoutChoosing] = useState(false)
  const groupName = useId()
  const helpId = useId()
  const text = strings.baseFitting

  function submit(event: FormEvent) {
    event.preventDefault()
    if (chosen) onSubmit(chosen)
    else setTriedWithoutChoosing(true)
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <fieldset className={styles.fieldset} aria-describedby={helpId}>
        <legend className={styles.legend}>
          <h2>{text.question}</h2>
        </legend>
        <p id={helpId} className={styles.help}>
          {text.help}
        </p>
        <div className={styles.options}>
          {MT12.baseFittings.map((fitting) => (
            <label key={fitting} className={styles.option}>
              <span className={styles.picture}>
                <BaseFittingDrawing fitting={fitting} />
              </span>
              <span className={styles.choice}>
                <input
                  type="radio"
                  className={styles.radio}
                  name={groupName}
                  value={fitting}
                  checked={chosen === fitting}
                  onChange={() => setChosen(fitting)}
                />
                <span className={styles.label}>{text.options[fitting].label}</span>
              </span>
              <span className={styles.description}>{text.options[fitting].description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className={styles.problem} role="alert">
        {triedWithoutChoosing && !chosen ? text.chooseFirst : null}
      </p>
      {saysItCanChangeLater && <p className={styles.later}>{text.changeLater}</p>}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="large">
          {submitLabel}
        </Button>
        {secondary}
      </div>
    </form>
  )
}
