import { useState, type DragEvent } from 'react'
import { Button, ButtonLink } from '../../components/Button.tsx'
import { CheckIcon, GripIcon, PlusIcon } from '../../components/icons.tsx'
import { MT12 } from '../../domain/catalog.ts'
import type { Model, ModelId } from '../../domain/model.ts'
import { lastTakenPosition } from '../../domain/positions.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './ModelList.module.css'
import { tagsFor } from './modelTags.ts'
import { rowId } from './rowId.ts'

const text = strings.models

/** A row being dragged: which model, where it started, and the position the pointer is over. */
interface Drag {
  modelId: ModelId
  from: number
  over: number | null
}

/** Where the dragged row would land compared with the row under the pointer. */
type DropSide = 'before' | 'after' | undefined

interface RowTarget {
  dropSide: DropSide
  onDragOver: (event: DragEvent<HTMLLIElement>) => void
  onDrop: (event: DragEvent<HTMLLIElement>) => void
}

interface ModelRowProps extends RowTarget {
  model: Model
  isCurrent: boolean
  isDragging: boolean
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onCopy: () => void
  onMove: () => void
  onDelete: () => void
}

function ModelRow({
  model,
  isCurrent,
  isDragging,
  dropSide,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onCopy,
  onMove,
  onDelete,
}: ModelRowProps) {
  const tags = tagsFor(model)

  return (
    <li
      id={rowId(model.id)}
      className={styles.row}
      tabIndex={-1}
      data-current={isCurrent || undefined}
      data-dragging={isDragging || undefined}
      data-drop={dropSide}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span
        className={styles.handle}
        draggable
        title={text.dragHandle(model.name)}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <span className={styles.grip} aria-hidden="true">
          <GripIcon />
        </span>
        <span className={styles.number}>
          <span className="visually-hidden">{text.columns.position} </span>
          {model.position}
        </span>
      </span>

      <div className={styles.flow}>
        <h2 className={styles.name}>{model.name}</h2>
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

      <div className={styles.side}>
        <span className={styles.receiver}>
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
          <Button
            variant="quiet"
            size="small"
            aria-label={text.copyNamed(model.name)}
            onClick={onCopy}
          >
            {text.copy}
          </Button>
          <Button
            variant="quiet"
            size="small"
            aria-label={text.moveNamed(model.name)}
            onClick={onMove}
          >
            {text.move}
          </Button>
          <Button
            variant="quiet"
            size="small"
            aria-label={text.deleteNamed(model.name)}
            onClick={onDelete}
          >
            {text.delete}
          </Button>
        </div>
      </div>
    </li>
  )
}

/** An empty place that sits between two models. */
function EmptyRow({ position, dropSide, onDragOver, onDrop }: RowTarget & { position: number }) {
  return (
    <li className={styles.emptyRow} data-drop={dropSide} onDragOver={onDragOver} onDrop={onDrop}>
      <span className={styles.handle}>
        <span className={styles.number}>
          <span className="visually-hidden">{text.columns.position} </span>
          {position}
        </span>
      </span>
      <div className={styles.emptyWords}>
        <span className={styles.quiet}>{text.emptyPlace}</span>
        <ButtonLink
          variant="quiet"
          size="small"
          href={paths.addModel}
          icon={<PlusIcon />}
          aria-label={text.addHereNamed(position)}
        >
          {text.addHere}
        </ButtonLink>
      </div>
    </li>
  )
}

interface ModelListProps {
  models: readonly Model[]
  /** The model the radio is currently set to. */
  currentModelId: ModelId | null
  onCopy: (modelId: ModelId) => void
  /** The Move action was chosen, so the person should be asked for a position. */
  onMoveRequested: (modelId: ModelId) => void
  /** A row was dragged and dropped on another place. */
  onMoved: (modelId: ModelId, toPosition: number) => void
  onDelete: (modelId: ModelId) => void
}

/**
 * The radio's list, one row per place, from position 1 to the last place that holds a model.
 * An empty place between two models gets a row of its own. The empty places after the last
 * model are summed up in one line underneath.
 *
 * A row can be dragged by its handle and dropped on another row. Dropping on a row means
 * "move to that row's position", which is the same thing the Move dialog asks for.
 */
export function ModelList({ models, currentModelId, onCopy, onMoveRequested, onMoved, onDelete }: ModelListProps) {
  const [drag, setDrag] = useState<Drag | null>(null)

  const inPlace = new Map(models.map((model) => [model.position, model]))
  const last = lastTakenPosition(models)
  const positions = Array.from({ length: last }, (_, index) => index + 1)

  function target(position: number): RowTarget {
    // Moving down, the row lands after the one it is dropped on. Moving up, before it.
    let dropSide: DropSide
    if (drag && drag.over === position && position !== drag.from) {
      dropSide = position > drag.from ? 'after' : 'before'
    }
    return {
      dropSide,
      onDragOver: (event) => {
        if (!drag) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (drag.over !== position) setDrag({ ...drag, over: position })
      },
      onDrop: (event) => {
        if (!drag) return
        event.preventDefault()
        setDrag(null)
        if (position !== drag.from) onMoved(drag.modelId, position)
      },
    }
  }

  function startDrag(event: DragEvent<HTMLElement>, model: Model) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', model.name)
    // Show the whole row under the pointer, not just the handle.
    const row = event.currentTarget.closest('li')
    if (row) event.dataTransfer.setDragImage(row, event.nativeEvent.offsetX, row.offsetHeight / 2)
    setDrag({ modelId: model.id, from: model.position, over: null })
  }

  return (
    <div>
      <div className={styles.surface}>
        <div className={styles.head} aria-hidden="true">
          <span>{text.columns.position}</span>
          <span>{text.columns.model}</span>
          <div className={styles.side}>
            <span className={styles.receiver}>{text.columns.receiverType}</span>
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
                isDragging={drag?.modelId === model.id}
                {...target(position)}
                onDragStart={(event) => startDrag(event, model)}
                onDragEnd={() => setDrag(null)}
                onCopy={() => onCopy(model.id)}
                onMove={() => onMoveRequested(model.id)}
                onDelete={() => onDelete(model.id)}
              />
            ) : (
              <EmptyRow key={`empty-${position}`} position={position} {...target(position)} />
            )
          })}
        </ol>
      </div>
      {last < MT12.maxModels && <p className={styles.after}>{text.emptyAfter(last + 1, MT12.maxModels)}</p>}
    </div>
  )
}
