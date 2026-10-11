import { useState, type DragEvent } from 'react'

/** A row being dragged: the position it started in, and the position the pointer is over. */
interface Drag {
  from: number
  over: number | null
}

/** Where the dragged row would land compared with the row under the pointer. */
export type DropSide = 'before' | 'after' | undefined

/** What every row needs to be dragged and to be dropped on. */
export interface Draggable {
  isDragging: boolean
  dropSide: DropSide
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLLIElement>) => void
  onDrop: (event: DragEvent<HTMLLIElement>) => void
}

/**
 * Dragging rows of a list of places. Any row, a model or an empty place, can be dragged by its
 * handle and dropped on another row. Dropping on a row means "move to that row's position".
 * Gives a function that makes the drag and drop handlers for the row in a position. `label` is
 * what the row is called while it is being carried.
 */
export function useRowDrag(onMoved: (fromPosition: number, toPosition: number) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)

  return function draggable(position: number, label: string): Draggable {
    // Moving down, the row lands after the one it is dropped on. Moving up, before it.
    let dropSide: DropSide
    if (drag && drag.over === position && position !== drag.from) {
      dropSide = position > drag.from ? 'after' : 'before'
    }
    return {
      isDragging: drag?.from === position,
      dropSide,
      onDragStart: (event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', label)
        // Show the whole row under the pointer, not just the handle.
        const row = event.currentTarget.closest('li')
        if (row) event.dataTransfer.setDragImage(row, event.nativeEvent.offsetX, row.offsetHeight / 2)
        setDrag({ from: position, over: null })
      },
      onDragEnd: () => setDrag(null),
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
        if (position !== drag.from) onMoved(drag.from, position)
      },
    }
  }
}
