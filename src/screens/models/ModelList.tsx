import { useEffect } from 'react'
import { Button, ButtonLink } from '../../components/Button.tsx'
import { CheckIcon, PlusIcon } from '../../components/icons.tsx'
import { MT12 } from '../../domain/catalog.ts'
import type { Model, ModelId } from '../../domain/model.ts'
import { hasEmptyPlacesToCloseUp, lastTakenPosition } from '../../domain/positions.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './ModelList.module.css'
import { tagsFor } from './modelTags.ts'
import { RowHandle } from './RowHandle.tsx'
import { rowId, scrollToRow } from './rowId.ts'
import { useRowDrag, type Draggable } from './useRowDrag.ts'

const text = strings.models

// How long a newly added row stays marked.
const NEW_ROW_MARK_MS = 3000

interface ModelRowProps extends Draggable {
  model: Model
  isCurrent: boolean
  /** True for a model that was just added, which is marked for a moment. */
  isNew: boolean
  onCopy: () => void
  onMove: () => void
  onDelete: () => void
}

function ModelRow({ model, isCurrent, isNew, onCopy, onMove, onDelete, ...drag }: ModelRowProps) {
  const tags = tagsFor(model)

  return (
    <li
      id={rowId(model.id)}
      className={styles.row}
      tabIndex={-1}
      data-current={isCurrent || undefined}
      data-new={isNew || undefined}
      data-dragging={drag.isDragging || undefined}
      data-drop={drag.dropSide}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
    >
      <RowHandle
        position={model.position}
        title={text.dragHandle(model.name)}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
      />

      <h2 className={styles.name}>{model.name}</h2>

      <div className={styles.flow}>
        {/* First in the row's flow, so the tags run round it. It floats at the right of the first line. */}
        <div className={styles.side}>
          <span className={styles.receiver} data-receiver-name>
            <span className="visually-hidden">{text.columns.receiverType}: </span>
            {strings.receiverTypes[model.receiverTypeId]}
          </span>
          <div className={styles.actions}>
            <ButtonLink
              variant="quiet"
              size="small"
              href={paths.editModel(model.id)}
              aria-label={text.editNamed(model.name)}
            >
              {text.edit}
            </ButtonLink>
            <Button variant="quiet" size="small" aria-label={text.copyNamed(model.name)} onClick={onCopy}>
              {text.copy}
            </Button>
            <Button variant="quiet" size="small" aria-label={text.moveNamed(model.name)} onClick={onMove}>
              {text.move}
            </Button>
            <Button variant="quiet" size="small" aria-label={text.deleteNamed(model.name)} onClick={onDelete}>
              {text.delete}
            </Button>
          </div>
        </div>
        {isCurrent && (
          <span className={styles.mark}>
            <CheckIcon />
            <span>{text.currentMark}</span>
          </span>
        )}
        {tags.extras.length > 0 ? (
          <ul className={styles.tags}>
            {tags.extras.map((tag, index) => (
              // A model can have two extras with the same name, so the index is part of the key.
              <li key={`${index}-${tag}`} className={styles.tag}>
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <span className={styles.quiet}>{strings.tags.noExtras}</span>
        )}
        {tags.feedback && <span className={styles.quiet}>{tags.feedback}</span>}
      </div>
    </li>
  )
}

interface EmptyRowProps extends Draggable {
  position: number
  onMove: () => void
  /** Opens the wizard to add a model in this place. */
  onAdd: () => void
}

/** An empty place with a model somewhere after it. It can be dragged and moved like a model. */
function EmptyRow({ position, onMove, onAdd, ...drag }: EmptyRowProps) {
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
        title={text.dragEmptyHandle(position)}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
      />
      <span className={styles.emptyName}>{text.emptyPlace}</span>
      <div className={styles.emptyActions}>
        <ButtonLink
          variant="quiet"
          size="small"
          href={paths.addStep('name')}
          icon={<PlusIcon />}
          aria-label={text.addHereNamed(position)}
          onClick={(event) => {
            event.preventDefault()
            onAdd()
          }}
        >
          {text.addHere}
        </ButtonLink>
        <Button variant="quiet" size="small" aria-label={text.moveEmptyNamed(position)} onClick={onMove}>
          {text.move}
        </Button>
      </div>
    </li>
  )
}

interface ModelListProps {
  models: readonly Model[]
  /** The model the radio is currently set to. */
  currentModelId: ModelId | null
  onCopy: (modelId: ModelId) => void
  /** The Move action was chosen on the row in this position, so the person should be asked where to. */
  onMoveRequested: (position: number) => void
  /** A row was dragged and dropped on another place. */
  onMoved: (fromPosition: number, toPosition: number) => void
  onDelete: (modelId: ModelId) => void
  /** Removes every empty place that has a model after it. */
  onCloseUp: () => void
  /** Opens the wizard to add a model in an empty place. */
  onAddAt: (position: number) => void
  /** A model that was just added. The list scrolls to its row and marks it for a moment. */
  newModelId: ModelId | null
  /** Called once the mark has been shown for long enough. */
  onNewModelMarked: () => void
}

/**
 * The radio's list, one row per place, from position 1 to the last place that holds a model.
 * An empty place with a model after it gets a row of its own. The empty places after the last
 * model are summed up in one line underneath.
 *
 * Any row, a model or an empty place, can be dragged by its handle and dropped on another row.
 * Dropping on a row means "move to that row's position", which is what the Move dialog asks for.
 * See useRowDrag.ts.
 */
export function ModelList({
  models,
  currentModelId,
  onCopy,
  onMoveRequested,
  onMoved,
  onDelete,
  onCloseUp,
  onAddAt,
  newModelId,
  onNewModelMarked,
}: ModelListProps) {
  const draggable = useRowDrag(onMoved)

  useEffect(() => {
    if (!newModelId) return
    scrollToRow(newModelId)
    const timer = window.setTimeout(onNewModelMarked, NEW_ROW_MARK_MS)
    return () => window.clearTimeout(timer)
  }, [newModelId, onNewModelMarked])

  const inPlace = new Map(models.map((model) => [model.position, model]))
  const last = lastTakenPosition(models)
  const positions = Array.from({ length: last }, (_, index) => index + 1)

  return (
    <div>
      <div className={styles.surface}>
        <div className={styles.head}>
          <span aria-hidden="true">{text.columns.position}</span>
          <span aria-hidden="true">{text.columns.model}</span>
          <div className={styles.side}>
            <span className={styles.receiver} aria-hidden="true">
              {text.columns.receiverType}
            </span>
            {hasEmptyPlacesToCloseUp(models) && (
              <button type="button" className={styles.closeUp} onClick={onCloseUp}>
                {text.closeUp}
              </button>
            )}
          </div>
        </div>
        <ol className={styles.list}>
          {positions.map((position) => {
            const model = inPlace.get(position)
            return model ? (
              <ModelRow
                key={model.id}
                model={model}
                isCurrent={model.id === currentModelId}
                isNew={model.id === newModelId}
                {...draggable(position, model.name)}
                onCopy={() => onCopy(model.id)}
                onMove={() => onMoveRequested(position)}
                onDelete={() => onDelete(model.id)}
              />
            ) : (
              <EmptyRow
                key={`empty-${position}`}
                position={position}
                {...draggable(position, text.emptyPlace)}
                onMove={() => onMoveRequested(position)}
                onAdd={() => onAddAt(position)}
              />
            )
          })}
        </ol>
      </div>
      {last < MT12.maxModels && <p className={styles.after}>{text.emptyAfter(last + 1, MT12.maxModels)}</p>}
    </div>
  )
}
