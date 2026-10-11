import { Button, ButtonLink } from '../../components/Button.tsx'
import { CheckIcon } from '../../components/icons.tsx'
import { MT12 } from '../../domain/catalog.ts'
import type { CardModel, CardReading } from '../../files/card.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import { spokenName } from './cardWords.ts'
import styles from './ModelList.module.css'
import { RowHandle } from './RowHandle.tsx'
import { placeRowId, rowId } from './rowId.ts'
import { useRowDrag, type Draggable } from './useRowDrag.ts'

const text = strings.card
const say = strings.models
const columns = say.columns

function CurrentMark() {
  return (
    <span className={styles.mark}>
      <CheckIcon />
      <span>{say.currentMark}</span>
    </span>
  )
}

interface ModelRowProps extends Draggable {
  model: CardModel
  isCurrent: boolean
  onCopy: () => void
  onMove: () => void
  onDelete: () => void
}

function ModelRow({ model, isCurrent, onCopy, onMove, onDelete, ...drag }: ModelRowProps) {
  const name = spokenName(model)
  // A file the app could not read as a model still has its row. It can be moved and deleted,
  // which only carry its bytes, but not edited or copied, which need to read it.
  const readable = model.name !== null

  const moveAndDelete = (
    <>
      <Button variant="quiet" size="small" aria-label={say.moveNamed(name)} onClick={onMove}>
        {say.move}
      </Button>
      <Button variant="quiet" size="small" aria-label={say.deleteNamed(name)} onClick={onDelete}>
        {say.delete}
      </Button>
    </>
  )

  return (
    <li
      id={rowId(placeRowId(model.position))}
      className={styles.row}
      tabIndex={-1}
      data-current={isCurrent || undefined}
      data-dragging={drag.isDragging || undefined}
      data-drop={drag.dropSide}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
    >
      <RowHandle
        position={model.position}
        title={say.dragHandle(name)}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
      />

      {readable ? (
        <>
          <h2 className={styles.name}>{model.name || text.noName}</h2>
          <div className={styles.flow}>
            {/* First in the row's flow, as in the sample list. It floats at the right of the first line. */}
            <div className={styles.side}>
              <span className={styles.receiver} data-receiver-name>
                <span className="visually-hidden">{columns.receiverType}: </span>
                {model.receiverTypeId ? strings.receiverTypes[model.receiverTypeId] : text.receiverNotKnown}
              </span>
              <div className={styles.actions}>
                <ButtonLink
                  variant="quiet"
                  size="small"
                  href={paths.editModel(placeRowId(model.position))}
                  aria-label={say.editNamed(name)}
                >
                  {say.edit}
                </ButtonLink>
                <Button variant="quiet" size="small" aria-label={say.copyNamed(name)} onClick={onCopy}>
                  {say.copy}
                </Button>
                {moveAndDelete}
              </div>
            </div>
            {isCurrent && <CurrentMark />}
          </div>
        </>
      ) : (
        <div className={`${styles.flow} ${styles.unread}`}>
          <div className={styles.side}>
            <div className={styles.actions}>{moveAndDelete}</div>
          </div>
          <span className={styles.unreadWords}>
            {text.fileNotRead}{' '}
            {model.refusal ? strings.files.refused[model.refusal.reason](model.refusal.line) : text.notAModel}
          </span>{' '}
          {isCurrent && <CurrentMark />}
        </div>
      )}
    </li>
  )
}

interface EmptyRowProps extends Draggable {
  position: number
  onMove: () => void
}

/** An empty place with a model somewhere after it. It can be dragged and moved like a model. */
function EmptyRow({ position, onMove, ...drag }: EmptyRowProps) {
  return (
    <li
      className={styles.emptyRow}
      data-dragging={drag.isDragging || undefined}
      data-drop={drag.dropSide}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
    >
      <RowHandle
        position={position}
        title={say.dragEmptyHandle(position)}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
      />
      <span className={styles.emptyName}>{say.emptyPlace}</span>
      <div className={styles.emptyActions}>
        <Button variant="quiet" size="small" aria-label={say.moveEmptyNamed(position)} onClick={onMove}>
          {say.move}
        </Button>
      </div>
    </li>
  )
}

interface CardModelListProps {
  /** What was read from the card. */
  reading: CardReading
  onCopy: (position: number) => void
  /** The Move action was chosen on the row in this position, so the person should be asked where to. */
  onMoveRequested: (position: number) => void
  /** A row was dragged and dropped on another place. */
  onMoved: (fromPosition: number, toPosition: number) => void
  onDelete: (position: number) => void
  /** Removes every empty place that has a model after it. */
  onCloseUp: () => void
}

/**
 * A real card's list, one row per place, from position 1 to the last place that holds a model.
 * It has the sample list's handles and buttons, and works the same way. What the app cannot yet
 * read from a model's file, its extras and its feedback, is left out of the row. Nothing is added
 * from here yet, so an empty place has no "Add a model here".
 */
export function CardModelList({ reading, onCopy, onMoveRequested, onMoved, onDelete, onCloseUp }: CardModelListProps) {
  const draggable = useRowDrag(onMoved)

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
            {/* An empty place with a model after it is one that closing up would remove. */}
            {last > inPlace.size && (
              <button type="button" className={styles.closeUp} onClick={onCloseUp}>
                {say.closeUp}
              </button>
            )}
          </div>
        </div>
        <ol className={styles.list}>
          {positions.map((position) => {
            const model = inPlace.get(position)
            return model ? (
              <ModelRow
                key={position}
                model={model}
                isCurrent={position === reading.currentPosition}
                {...draggable(position, spokenName(model))}
                onCopy={() => onCopy(position)}
                onMove={() => onMoveRequested(position)}
                onDelete={() => onDelete(position)}
              />
            ) : (
              <EmptyRow
                key={position}
                position={position}
                {...draggable(position, say.emptyPlace)}
                onMove={() => onMoveRequested(position)}
              />
            )
          })}
        </ol>
      </div>
      {last < MT12.maxModels && <p className={styles.after}>{say.emptyAfter(last + 1, MT12.maxModels)}</p>}
    </div>
  )
}
