import type { FormEvent } from 'react'
import { Button, ButtonLink } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { ModelNameField } from '../../components/ModelNameField.tsx'
import type { CardModel } from '../../files/card.ts'
import type { CardEdit } from '../../state/cardState.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import wizardStyles from '../addModel/AddModelScreen.module.css'
import stepStyles from '../addModel/steps.module.css'
import { placeRowId } from '../models/rowId.ts'
import { EditFrame } from './EditFrame.tsx'
import styles from './EditModel.module.css'

const text = strings.editModel
const question = strings.addModel.name

interface CardNameScreenProps {
  /** The name as it stands on the page. Nothing here changes the card until "Save changes". */
  edit: CardEdit
  /** The model as it is on the card. */
  model: CardModel
  /** True when the radio is set to this model. */
  isCurrent: boolean
  /** The names of the other models on the card. This one may keep its own. */
  namesInUse: readonly string[]
  /** True when the person has started to leave with a change not yet saved, so the leave question should be asked. */
  leaving: boolean
  onChange: (name: string) => void
  onSave: () => void
  onKeepEditing: () => void
  onLeave: () => void
}

/**
 * The name page for a model on a real card: the same question, the same field and the same bar as
 * the name page for a sample model. The name has one more rule here, because the radio's file
 * can only keep plain characters.
 */
export function CardNameScreen({
  edit,
  model,
  isCurrent,
  namesInUse,
  leaving,
  onChange,
  onSave,
  onKeepEditing,
  onLeave,
}: CardNameScreenProps) {
  const name = model.name || strings.card.noName

  function save(event: FormEvent) {
    event.preventDefault()
    onSave()
  }

  return (
    <EditFrame model={{ name, position: model.position }} isCurrent={isCurrent}>
      <form className={styles.form} onSubmit={save} noValidate>
        <div className={stepStyles.step}>
          <ModelNameField
            label={question.question}
            size="main"
            help={question.help}
            value={edit.name}
            onChange={onChange}
            namesInUse={namesInUse}
            plainOnly
            emptyMessage={question.empty}
            tried={edit.tried}
          />
        </div>

        <div className={wizardStyles.actions} data-sticks-to-window>
          <Button type="submit" variant="primary">
            {text.save}
          </Button>
          {/* Cancel goes back to the model. With a change not yet saved, that asks first. */}
          <ButtonLink href={paths.editModel(placeRowId(model.position))}>{text.cancel}</ButtonLink>
        </div>
      </form>

      {leaving && (
        <Dialog title={text.leave.title} onDismiss={onKeepEditing}>
          <p>{text.leave.body(name)}</p>
          <DialogActions>
            <Button variant="primary" onClick={onKeepEditing} data-autofocus>
              {text.leave.keepEditing}
            </Button>
            <Button onClick={onLeave}>{text.leave.leave}</Button>
          </DialogActions>
        </Dialog>
      )}
    </EditFrame>
  )
}
