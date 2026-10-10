import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { MT12 } from '../../domain/catalog.ts'
import type { Model } from '../../domain/model.ts'
import { checkModelName } from '../../domain/modelName.ts'
import { strings } from '../../strings/en.ts'
import styles from './CopyDialog.module.css'

interface CopyDialogProps {
  model: Model
  /** Names already on the radio. The copy may not reuse one. */
  namesInUse: readonly string[]
  /** A name to start with. Only the review scenarios use this. */
  draftName?: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

const text = strings.copy
const maxLength = MT12.maxModelNameLength

/** Asks for the copy's name and checks it as the person types. */
export function CopyDialog({ model, namesInUse, draftName = '', onConfirm, onCancel }: CopyDialogProps) {
  const [name, setName] = useState(draftName)
  const [triedEmpty, setTriedEmpty] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  const hintId = useId()
  const countId = useId()
  const problemId = useId()

  const used = name.trim().length
  const problem = checkModelName(name, namesInUse)
  // An empty field is only a problem once the person has tried to carry on with it.
  const shownProblem = problem === 'empty' && !triedEmpty ? null : problem

  function submit(event: FormEvent) {
    event.preventDefault()
    if (problem) {
      setTriedEmpty(true)
      field.current?.focus()
    } else {
      onConfirm(name.trim())
    }
  }

  return (
    <Dialog title={text.title(model.name)} onDismiss={onCancel}>
      <form onSubmit={submit} noValidate>
        <label className={styles.label} htmlFor={fieldId}>
          {text.nameLabel}
        </label>
        <p id={hintId} className={styles.hint}>
          {text.nameHint(maxLength)}
        </p>
        <input
          ref={field}
          id={fieldId}
          className={styles.field}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={`${hintId} ${countId} ${problemId}`}
          aria-invalid={shownProblem ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          data-autofocus
        />
        <div className={styles.below}>
          <p id={problemId} className={styles.problem} role="alert">
            {shownProblem === 'empty' && text.problems.empty}
            {shownProblem === 'tooLong' && text.problems.tooLong(used, maxLength)}
            {shownProblem === 'alreadyUsed' && text.problems.alreadyUsed}
          </p>
          <p id={countId} className={used > maxLength ? `${styles.count} ${styles.over}` : styles.count}>
            {text.count(used, maxLength)}
          </p>
        </div>
        <DialogActions>
          <Button type="submit" variant="primary">
            {text.confirm}
          </Button>
          <Button onClick={onCancel}>{text.cancel}</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
