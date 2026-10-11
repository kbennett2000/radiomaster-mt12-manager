import { CheckIcon } from '../../components/icons.tsx'
import { MT12 } from '../../domain/catalog.ts'
import type { CardModel, CardReading } from '../../files/card.ts'
import { strings } from '../../strings/en.ts'
import styles from './ModelList.module.css'
import { placeRowId, rowId } from './rowId.ts'

const text = strings.card
const columns = strings.models.columns

/** The position number at the start of a row. There is no handle: nothing on a real card can be dragged. */
function Place({ position }: { position: number }) {
  return (
    <span className={styles.handle}>
      <span className={styles.number}>
        <span className="visually-hidden">{columns.position} </span>
        {position}
      </span>
    </span>
  )
}

function CurrentMark() {
  return (
    <span className={styles.mark}>
      <CheckIcon />
      <span>{strings.models.currentMark}</span>
    </span>
  )
}

function ModelRow({ model, isCurrent }: { model: CardModel; isCurrent: boolean }) {
  const row = { id: rowId(placeRowId(model.position)), className: styles.row, tabIndex: -1 }

  // A file the app could not read as a model still has its row, in its position.
  if (model.name === null) {
    const why = model.refusal ? strings.files.refused[model.refusal.reason](model.refusal.line) : text.notAModel
    return (
      <li {...row} data-current={isCurrent || undefined}>
        <Place position={model.position} />
        <p className={styles.unread}>
          {text.fileNotRead} {why} {isCurrent && <CurrentMark />}
        </p>
      </li>
    )
  }

  return (
    <li {...row} data-current={isCurrent || undefined}>
      <Place position={model.position} />
      <h2 className={styles.name}>{model.name || text.noName}</h2>
      <div className={styles.flow}>
        <div className={styles.side}>
          {/*
           * The receiver type starts where it does in the sample list. With no buttons after it,
           * it has their room as well, which the words for a type the app does not know need.
           */}
          <span className={`${styles.receiver} ${styles.receiverAlone}`} data-receiver-name>
            <span className="visually-hidden">{columns.receiverType}: </span>
            {model.receiverTypeId ? strings.receiverTypes[model.receiverTypeId] : text.receiverNotKnown}
          </span>
        </div>
        {isCurrent && <CurrentMark />}
      </div>
    </li>
  )
}

/**
 * A real card's list, one row per place, from position 1 to the last place that holds a model.
 * It shows what was read and offers no way to change it: no handles and no buttons. What the app
 * cannot yet read from a model's file, its extras and its feedback, is left out of the row.
 */
export function CardModelList({ reading }: { reading: CardReading }) {
  const inPlace = new Map(reading.models.map((model) => [model.position, model]))
  const last = Math.max(0, ...inPlace.keys())
  const positions = Array.from({ length: last }, (_, index) => index + 1)

  return (
    <div>
      <div className={styles.surface}>
        <div className={styles.head}>
          <span aria-hidden="true">{columns.position}</span>
          <span aria-hidden="true">{columns.model}</span>
          <div className={styles.side}>
            <span className={styles.receiver} aria-hidden="true">
              {columns.receiverType}
            </span>
          </div>
        </div>
        <ol className={styles.list}>
          {positions.map((position) => {
            const model = inPlace.get(position)
            return model ? (
              <ModelRow key={position} model={model} isCurrent={position === reading.currentPosition} />
            ) : (
              <li key={position} className={styles.emptyRow}>
                <Place position={position} />
                <span className={styles.emptyName}>{strings.models.emptyPlace}</span>
              </li>
            )
          })}
        </ol>
      </div>
      {last < MT12.maxModels && <p className={styles.after}>{strings.models.emptyAfter(last + 1, MT12.maxModels)}</p>}
    </div>
  )
}
