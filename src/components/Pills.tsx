import { useId } from 'react'
import type { LightColour } from '../domain/catalog.ts'
import styles from './Pills.module.css'

interface Pill<Value extends string> {
  value: Value
  label: string
  /** A dot of one of the radio's light colours, shown before the word. */
  dot?: LightColour
}

interface PillsProps<Value extends string> {
  options: readonly Pill<Value>[]
  value: Value
  onChange: (value: Value) => void
  /** The id of the words that name this choice, when they are on the page. */
  labelledBy?: string
  /** A name for the choice, when the words on the page do not say enough on their own. */
  label?: string
  /** The id of words that explain the choice. */
  describedBy?: string
}

/** A dot of one of the radio's light colours. It always sits beside the colour's name. */
export function ColourDot({ colour }: { colour: LightColour | null }) {
  return <span className={styles.dot} data-colour={colour ?? 'none'} aria-hidden="true" />
}

/** A choice between a few short answers, side by side. */
export function Pills<Value extends string>({
  options,
  value,
  onChange,
  labelledBy,
  label,
  describedBy,
}: PillsProps<Value>) {
  const name = useId()
  return (
    <div
      className={styles.pills}
      role="radiogroup"
      aria-labelledby={label ? undefined : labelledBy}
      aria-label={label}
      aria-describedby={describedBy}
    >
      {options.map((option) => (
        <label key={option.value} className={styles.pill}>
          <input
            type="radio"
            className={styles.radio}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.dot && <ColourDot colour={option.dot} />}
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}
