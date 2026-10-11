import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { MT12 } from '../../domain/catalog.ts'
import { describeMove, modelAt, type MoveEffect, type Placed } from '../../domain/positions.ts'
import { strings } from '../../strings/en.ts'
import styles from './MoveDialog.module.css'

/** A model as far as this dialog needs it: where it is and what to call it. */
interface Listed extends Placed {
  name: string
}

interface MoveDialogProps {
  /** The place being moved. It holds a model or it is empty. */
  fromPosition: number
  /** Every model on the radio, so the dialog can say what is where. */
  models: readonly Listed[]
  /** A position to start on. Only the review scenarios use this. */
  toPosition?: number
  onConfirm: (toPosition: number) => void
  onCancel: () => void
}

const text = strings.moveModel
const allPositions = Array.from({ length: MT12.maxModels }, (_, index) => index + 1)

/** What else changes place, in one sentence. */
function shiftSentence({ shifted, direction }: MoveEffect<Listed>): string {
  if (shifted.length === 0) return text.nothingElseMoves
  const step = direction === 'up' ? -1 : 1
  if (shifted.length === 1) {
    return text.oneOtherMoves(shifted[0].name, shifted[0].position, shifted[0].position + step)
  }
  return text.othersMove(shifted.length, shifted[0].position, shifted[shifted.length - 1].position, direction)
}

/**
 * Asks which position a model, or an empty place, should move to, and says what that will do
 * before it is done. Dragging a row does the same thing. This dialog is the way to do it from
 * the keyboard.
 */
export function MoveDialog({ fromPosition, models, toPosition, onConfirm, onCancel }: MoveDialogProps) {
  const [position, setPosition] = useState(toPosition ?? fromPosition)
  const [tried, setTried] = useState(false)
  const select = useRef<HTMLSelectElement>(null)
  const selectId = useId()
  const effectId = useId()

  const model = modelAt(models, fromPosition)
  const effect = describeMove(models, fromPosition, position)
  const samePlace = position === fromPosition
  // An empty place moved past no models leaves the list exactly as it was.
  const changesNothing = !samePlace && !model && effect.shifted.length === 0
  const refused = samePlace || changesNothing

  function submit(event: FormEvent) {
    event.preventDefault()
    if (refused) {
      setTried(true)
      select.current?.focus()
    } else {
      onConfirm(position)
    }
  }

  let lines: string[]
  if (samePlace && tried) {
    lines = [model ? text.alreadyThere(model.name, position) : text.alreadyThereEmpty(position)]
  } else if (samePlace) {
    lines = [model ? text.nowHolds(position, model.name) : text.startEmpty(position)]
  } else if (changesNothing) {
    lines = [text.nothingWouldChange(position)]
  } else {
    lines = [
      effect.occupant ? text.nowHolds(position, effect.occupant.name) : text.nowEmpty(position),
      shiftSentence(effect),
    ]
  }
  const showAsProblem = (samePlace && tried) || changesNothing

  return (
    <Dialog title={model ? text.title(model.name) : text.titleEmpty(fromPosition)} onDismiss={onCancel}>
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
          aria-invalid={showAsProblem ? true : undefined}
          data-autofocus
        >
          {allPositions.map((place) => {
            const holder = modelAt(models, place)
            let words: string
            if (place === fromPosition) {
              words = holder ? text.placeOwn(place, holder.name) : text.placeOwnEmpty(place)
            } else {
              words = holder ? text.placeHolding(place, holder.name) : text.placeEmpty(place)
            }
            return (
              <option key={place} value={place}>
                {words}
              </option>
            )
          })}
        </select>
        <div id={effectId} className={styles.effect} aria-live="polite">
          {lines.map((line) => (
            <p key={line} className={showAsProblem ? styles.problem : undefined}>
              {line}
            </p>
          ))}
        </div>
        <DialogActions>
          <Button type="submit" variant="primary">
            {model ? text.confirm : text.confirmEmpty}
          </Button>
          <Button onClick={onCancel}>{text.cancel}</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
