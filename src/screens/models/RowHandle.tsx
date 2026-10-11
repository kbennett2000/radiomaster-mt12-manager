import type { DragEvent } from 'react'
import { GripIcon } from '../../components/icons.tsx'
import { strings } from '../../strings/en.ts'
import styles from './ModelList.module.css'

interface RowHandleProps {
  position: number
  /** What dragging this handle moves, in words. */
  title: string
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}

/** The grip and the position number at the start of a row. Dragging it moves the row. */
export function RowHandle({ position, title, onDragStart, onDragEnd }: RowHandleProps) {
  return (
    <span className={styles.handle} draggable title={title} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <span className={styles.grip} aria-hidden="true">
        <GripIcon />
      </span>
      <span className={styles.number}>
        <span className="visually-hidden">{strings.models.columns.position} </span>
        {position}
      </span>
    </span>
  )
}
