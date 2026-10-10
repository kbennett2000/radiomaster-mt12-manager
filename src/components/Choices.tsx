// Questions answered by picking one of a few choices. Each choice is a real radio button inside a
// card, so the whole card can be clicked and the arrow keys move between choices.

import { useId, type CSSProperties, type ReactNode } from 'react'
import styles from './Choices.module.css'

interface Choice<Value extends string> {
  value: Value
  label: string
  /** A few quieter words on the same line as the label, such as the kind of control. */
  note?: string
  /** A few plain words under the label. */
  description?: string
  /** Set when the choice cannot be picked. It says why, in place of the note. */
  unavailable?: string
}

interface PictureChoice<Value extends string> extends Choice<Value> {
  picture: ReactNode
}

interface QuestionProps<Value extends string> {
  question: string
  /** 'main' is a question that heads its part of the page. 'field' is one of several under a heading. */
  size?: 'main' | 'field'
  help?: string
  value: Value | null
  onChange: (value: Value) => void
  /** A plain message shown beside the choices when an answer is missing. */
  problem?: string | null
}

interface FrameProps {
  question: string
  size: 'main' | 'field'
  help?: string
  problem?: string | null
  children: ReactNode
}

function Frame({ question, size, help, problem, children }: FrameProps) {
  const helpId = useId()
  return (
    <fieldset className={styles.fieldset} aria-describedby={help ? helpId : undefined}>
      <legend className={styles.legend}>
        {size === 'main' ? <h2>{question}</h2> : <span className={styles.fieldQuestion}>{question}</span>}
      </legend>
      {help && (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      )}
      {/* Said right under the question, so it is seen even when the choices run past the window. */}
      <p className={styles.problem} role="alert">
        {problem ?? null}
      </p>
      {children}
    </fieldset>
  )
}

/** A question whose choices each have a line drawing. */
export function PictureChoices<Value extends string>({
  question,
  size = 'main',
  help,
  options,
  value,
  onChange,
  problem,
}: QuestionProps<Value> & { options: readonly PictureChoice<Value>[] }) {
  const groupName = useId()
  return (
    <Frame question={question} size={size} help={help} problem={problem}>
      <div
        className={styles.pictures}
        data-count={options.length}
        style={{ '--choices': options.length } as CSSProperties}
      >
        {options.map((option) => (
          <label key={option.value} className={styles.card}>
            <span className={styles.picture}>{option.picture}</span>
            <span className={styles.choice}>
              <input
                type="radio"
                className={styles.radio}
                name={groupName}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <span className={styles.label}>{option.label}</span>
            </span>
            {option.description && <span className={styles.description}>{option.description}</span>}
          </label>
        ))}
      </div>
    </Frame>
  )
}

const wordLayouts = { row: styles.wordsRow, stack: styles.wordsStack, grid: styles.wordsGrid }

/**
 * A question whose choices are words only. 'row' sets short choices side by side, 'stack' sets
 * them one under another, and 'grid' fits as many columns as there is room for.
 */
export function RadioChoices<Value extends string>({
  question,
  size = 'main',
  help,
  options,
  value,
  onChange,
  problem,
  layout = 'stack',
}: QuestionProps<Value> & { options: readonly Choice<Value>[]; layout?: 'row' | 'stack' | 'grid' }) {
  const groupName = useId()
  return (
    <Frame question={question} size={size} help={help} problem={problem}>
      <div className={wordLayouts[layout]}>
        {options.map((option) => {
          const beside = option.unavailable ?? option.note
          return (
            <label key={option.value} className={`${styles.card} ${styles.wordCard}`}>
              <span className={styles.choice}>
                <input
                  type="radio"
                  className={styles.radio}
                  name={groupName}
                  value={option.value}
                  checked={value === option.value}
                  disabled={option.unavailable !== undefined}
                  onChange={() => onChange(option.value)}
                />
                <span>
                  <span className={styles.wordLabel}>{option.label}</span>
                  {beside && <span className={styles.wordNote}> · {beside}</span>}
                </span>
              </span>
              {option.description && <span className={styles.wordDescription}>{option.description}</span>}
            </label>
          )
        })}
      </div>
    </Frame>
  )
}
