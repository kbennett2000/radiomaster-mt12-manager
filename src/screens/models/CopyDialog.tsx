import { useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { ModelNameField } from '../../components/ModelNameField.tsx'
import { checkModelName } from '../../domain/modelName.ts'
import { strings } from '../../strings/en.ts'
import styles from './CopyDialog.module.css'

interface CopyDialogProps {
  /** The model being copied. Only its name is said. */
  model: { name: string }
  /** Names already on the radio. The copy may not reuse one. */
  namesInUse: readonly string[]
  /** True when the copy is going onto a real card, which can only hold plain characters. */
  plainOnly?: boolean
  /** A name to start with. Only the review scenarios use this. */
  draftName?: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

const text = strings.copy

/** Asks for the copy's name and checks it as the person types. */
export function CopyDialog({ model, namesInUse, plainOnly = false, draftName = '', onConfirm, onCancel }: CopyDialogProps) {
  const [name, setName] = useState(draftName)
  const [tried, setTried] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (checkModelName(name, namesInUse, { plainOnly })) {
      setTried(true)
      field.current?.focus()
    } else {
      onConfirm(name.trim())
    }
  }

  return (
    <Dialog title={text.title(model.name)} onDismiss={onCancel}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <ModelNameField
          label={text.nameLabel}
          value={name}
          onChange={setName}
          namesInUse={namesInUse}
          plainOnly={plainOnly}
          emptyMessage={text.nameEmpty}
          tried={tried}
          inputRef={field}
          focusFirst
        />
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
