import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { MT12 } from '../../domain/catalog.ts'
import type { Model } from '../../domain/model.ts'
import { describeMove, modelAt } from '../../domain/positions.ts'
import { strings } from '../../strings/en.ts'
import styles from './MoveDialog.module.css'

interface MoveDialogProps {
  model: Model
  /** Every model on the radio, so the dialog can say what is where. */
  models: readonly Model[]
  /** A position to start on. Only the review scenarios use this. */
  toPosition?: number
  onConfirm: (toPosition: number) => void
  onCancel: () => void
}

const text = strings.moveModel
const allPositions = Array.from({ length: MT12.maxModels }, (_, index) => index + 1)

/** What else changes place, in one sentence. */
function shiftSentence(models: readonly Model[], model: Model, toPosition: number): string {
  const { shifted, direction } = describeMove(models, model.id, toPosition)
  if (shifted.length === 0) return text.nothingElseMoves
  const step = direction === 'up' ? -1 : 1
  if (shifted.length === 1) {
    return text.oneOtherMoves(shifted[0].name, shifted[0].position, shifted[0].position + step)
  }
  return text.othersMove(shifted.length, shifted[0].position, shifted[shifted.length - 1].position, direction)
}

/**
 * Asks which position a model should move to, and says what that will do before it is done.
 * Dragging a row does the same thing. This dialog is the way to do it from the keyboard.
 */
export function MoveDialog({ model, models, toPosition, onConfirm, onCancel }: MoveDialogProps) {
  const [position, setPosition] = useState(toPosition ?? model.position)
  const [triedSamePlace, setTriedSamePlace] = useState(false)
  const select = useRef<HTMLSelectElement>(null)
  const selectId = useId()
  const effectId = useId()

  const samePlace = position === model.position
  const occupant = describeMove(models, model.id, position).occupant

  function submit(event: FormEvent) {
    event.preventDefault()
    if (samePlace) {
      setTriedSamePlace(true)
      select.current?.focus()
    } else {
      onConfirm(position)
    }
  }

  return (
    <Dialog title={text.title(model.name)} onDismiss={onCancel}>
      <form onSubmit={submit} noValidate>
        <label className={styles.label} htmlFor={selectId}>
          {text.positionLabel}
        </label>
        <select
          ref={select}
          id={selectId}
          className={styles.select}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-describedby={effectId}
          aria-invalid={samePlace && triedSamePlace ? true : undefined}
          data-autofocus
        >
          {allPositions.map((place) => {
            const holder = modelAt(models, place)
            let words = text.placeEmpty(place)
            if (holder) {
              words = holder.id === model.id ? text.placeOwn(place, holder.name) : text.placeHolding(place, holder.name)
            }
            return (
              <option key={place} value={place}>
                {words}
              </option>
            )
          })}
        </select>
        <div id={effectId} className={styles.effect} aria-live="polite">
          {samePlace ? (
            <p className={triedSamePlace ? styles.problem : undefined}>
              {triedSamePlace ? text.alreadyThere(model.name, position) : text.nowHolds(position, model.name)}
            </p>
          ) : (
            <>
              <p>{occupant ? text.nowHolds(position, occupant.name) : text.nowEmpty(position)}</p>
              <p>{shiftSentence(models, model, position)}</p>
            </>
          )}
        </div>
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
