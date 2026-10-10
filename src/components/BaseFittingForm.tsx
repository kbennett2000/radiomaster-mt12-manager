import { useState, type FormEvent } from 'react'
import type { BaseFitting } from '../domain/radio.ts'
import { strings } from '../strings/en.ts'
import styles from './BaseFittingForm.module.css'
import { BaseFittingQuestion } from './BaseFittingQuestion.tsx'
import { Button } from './Button.tsx'

interface BaseFittingFormProps {
  submitLabel: string
  onSubmit: (baseFitting: BaseFitting) => void
}

/** The one question a radio is asked the first time it connects. Radio setup can change the answer later. */
export function BaseFittingForm({ submitLabel, onSubmit }: BaseFittingFormProps) {
  const [chosen, setChosen] = useState<BaseFitting | null>(null)
  const [triedWithoutChoosing, setTriedWithoutChoosing] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (chosen) onSubmit(chosen)
    else setTriedWithoutChoosing(true)
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <BaseFittingQuestion value={chosen} onChange={setChosen} showMissing={triedWithoutChoosing} />
      <p className={styles.later}>{strings.baseFitting.changeLater}</p>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="large">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
