import type { MouseEvent } from 'react'
import { ButtonLink } from '../../components/Button.tsx'
import { BackIcon } from '../../components/icons.tsx'
import type { CardModel } from '../../files/card.ts'
import type { CardNotice } from '../../state/cardState.ts'
import { goTo, paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import { SummaryRow } from '../addModel/ModelSummary.tsx'
import summaryStyles from '../addModel/ReviewStep.module.css'
import { CardSavedNotice } from '../card/CardSavedNotice.tsx'
import { placeRowId } from '../models/rowId.ts'
import { EditFrame } from './EditFrame.tsx'
import styles from './EditModel.module.css'

const text = strings.editModel
const rows = strings.addModel.review.rows

interface CardEditScreenProps {
  /** The model as it is on the card. Its file was read, so it has a name. */
  model: CardModel
  /** True when the radio is set to this model. */
  isCurrent: boolean
  /** The confirmation of the last change, when it was a change to this model's name. */
  notice: CardNotice | null
  /** Opens the name page. */
  onChangeName: () => void
  onUndo: () => void
  onNoticeDismissed: () => void
}

/**
 * The Edit page for a model on a real card. The app reads three things from a model's file so far,
 * so the page is short: its name, which can be changed here, and its position and receiver type,
 * which cannot. The rest of the model is not shown yet, and the page says so.
 */
export function CardEditScreen({ model, isCurrent, notice, onChangeName, onUndo, onNoticeDismissed }: CardEditScreenProps) {
  const id = placeRowId(model.position)
  const name = model.name || strings.card.noName

  const changeName = {
    href: paths.editPart(id, 'name'),
    onClick: (event: MouseEvent) => {
      // The address is changed first, so the page and the state never disagree for a moment.
      event.preventDefault()
      goTo(paths.editPart(id, 'name'))
      onChangeName()
    },
  }

  return (
    <EditFrame model={{ name, position: model.position }} isCurrent={isCurrent}>
      <div className={styles.notice} role="status">
        {notice && <CardSavedNotice notice={notice} onUndo={onUndo} onDismiss={onNoticeDismissed} />}
      </div>

      <dl className={summaryStyles.summary}>
        <SummaryRow label={rows.name} change={changeName}>
          {name}
        </SummaryRow>
        <SummaryRow label={rows.position} note={text.positionNote}>
          {model.position}
        </SummaryRow>
        <SummaryRow label={rows.receiver}>
          {model.receiverTypeId ? strings.receiverTypes[model.receiverTypeId] : strings.card.receiverNotKnown}
        </SummaryRow>
      </dl>

      <p className={styles.intro}>{strings.card.restOfModel}</p>

      <div>
        <ButtonLink variant="primary" size="large" icon={<BackIcon />} href={paths.home}>
          {text.backToModels}
        </ButtonLink>
      </div>
    </EditFrame>
  )
}
