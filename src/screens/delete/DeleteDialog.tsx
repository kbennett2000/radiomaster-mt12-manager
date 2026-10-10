import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import type { Model, ModelId } from '../../domain/model.ts'
import { strings } from '../../strings/en.ts'
import styles from './DeleteDialog.module.css'

interface DeleteDialogProps {
  model: Model
  /** The models the radio could switch to. Empty unless the radio is set to the model being deleted. */
  switchChoices: readonly Model[]
  /** A model already picked to switch to. Only the review scenarios use this. */
  switchToId?: ModelId
  /** True after the person tried to delete without picking a model to switch to. */
  triedWithoutPicking: boolean
  onConfirm: (switchToId?: ModelId) => void
  onKeep: () => void
}

const text = strings.deleteModel

/**
 * Confirms a delete. When the radio is set to the model being deleted, it also asks which model
 * the radio should switch to, and will not continue until one is picked.
 */
export function DeleteDialog({
  model,
  switchChoices,
  switchToId = '',
  triedWithoutPicking,
  onConfirm,
  onKeep,
}: DeleteDialogProps) {
  const [picked, setPicked] = useState<ModelId>(switchToId)
  const select = useRef<HTMLSelectElement>(null)
  const selectId = useId()
  const problemId = useId()

  const mustPick = switchChoices.length > 0
  const showProblem = mustPick && triedWithoutPicking && picked === ''

  useEffect(() => {
    if (showProblem) select.current?.focus()
  }, [showProblem])

  function submit(event: FormEvent) {
    event.preventDefault()
    onConfirm(picked === '' ? undefined : picked)
  }

  return (
    <Dialog title={text.title(model.name)} onDismiss={onKeep}>
      <form onSubmit={submit} noValidate>
        <p>{text.body}</p>
        {mustPick && (
          <div className={styles.switch}>
            <p>{text.currentIntro}</p>
            <label className={styles.label} htmlFor={selectId}>
              {text.switchLabel}
            </label>
            <select
              ref={select}
              id={selectId}
              className={styles.select}
              value={picked}
              onChange={(event) => setPicked(event.target.value)}
              aria-describedby={problemId}
              aria-invalid={showProblem ? true : undefined}
            >
              <option value="">{text.switchPlaceholder}</option>
              {switchChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>
            <p id={problemId} className={styles.problem} role="alert">
              {showProblem ? text.switchMissing : null}
            </p>
          </div>
        )}
        <DialogActions>
          <Button type="submit" variant="danger">
            {text.confirm}
          </Button>
          <Button onClick={onKeep} data-autofocus>
            {text.keep}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
