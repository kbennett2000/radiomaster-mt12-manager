import { useState, type FormEvent } from 'react'
import { BaseFittingQuestion } from '../../components/BaseFittingQuestion.tsx'
import { Button } from '../../components/Button.tsx'
import { RadioChoices } from '../../components/Choices.tsx'
import type { WhenDeleting } from '../../domain/positions.ts'
import type { BaseFitting } from '../../domain/radio.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './RadioSetupScreen.module.css'

interface RadioSetupScreenProps {
  baseFitting: BaseFitting | null
  whenDeleting: WhenDeleting
  onSave: (baseFitting: BaseFitting, whenDeleting: WhenDeleting) => void
}

const text = strings.radioSetup

const whenDeletingOptions = (['closeUp', 'leaveEmpty'] as const).map((value) => ({
  value,
  label: text.whenDeleting.options[value].label,
  description: text.whenDeleting.options[value].description,
}))

/** Lets the owner change what the app knows about their radio and how it behaves. Reached from the header. */
export function RadioSetupScreen({ baseFitting, whenDeleting, onSave }: RadioSetupScreenProps) {
  const [fitting, setFitting] = useState(baseFitting)
  const [deleting, setDeleting] = useState(whenDeleting)
  const [triedWithoutFitting, setTriedWithoutFitting] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (fitting) onSave(fitting, deleting)
    else setTriedWithoutFitting(true)
  }

  return (
    <form className={styles.page} onSubmit={submit} noValidate>
      <h1>{text.title}</h1>
      <BaseFittingQuestion value={fitting} onChange={setFitting} showMissing={triedWithoutFitting} />
      <RadioChoices
        question={text.whenDeleting.question}
        help={text.whenDeleting.help}
        options={whenDeletingOptions}
        value={deleting}
        onChange={setDeleting}
      />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="large">
          {text.save}
        </Button>
        <a className={styles.back} href={paths.home}>
          {text.back}
        </a>
      </div>
    </form>
  )
}
