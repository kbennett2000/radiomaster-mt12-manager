import { useId, type Ref } from 'react'
import { MT12 } from '../domain/catalog.ts'
import { checkModelName } from '../domain/modelName.ts'
import { strings } from '../strings/en.ts'
import styles from './ModelNameField.module.css'

interface ModelNameFieldProps {
  label: string
  /** 'main' shows the label as the main question of a page. 'field' is a field inside a dialog. */
  size?: 'main' | 'field'
  /** A plain sentence shown before the "Up to 10 characters" hint. */
  help?: string
  value: string
  onChange: (name: string) => void
  /** Names already on the radio. A new model may not reuse one. */
  namesInUse: readonly string[]
  /** True for a name going onto a real card, which can only hold plain characters. */
  plainOnly?: boolean
  /** What to say when the name is empty. */
  emptyMessage: string
  /** True once the person has tried to carry on. An empty name is only pointed out after that. */
  tried: boolean
  inputRef?: Ref<HTMLInputElement>
  /** True when the field should have keyboard focus as soon as a dialog opens. */
  focusFirst?: boolean
}

const text = strings.modelName
const maxLength = MT12.maxModelNameLength

/**
 * The field for a model's name, with the rules every name follows: not empty, 10 characters at
 * most, and not a name another model has. The name is checked as the person types. The field has
 * no hard stop at 10 characters, so a pasted name is never cut short without a word.
 */
export function ModelNameField({
  label,
  size = 'field',
  help,
  value,
  onChange,
  namesInUse,
  plainOnly = false,
  emptyMessage,
  tried,
  inputRef,
  focusFirst = false,
}: ModelNameFieldProps) {
  const fieldId = useId()
  const hintId = useId()
  const countId = useId()
  const problemId = useId()

  const used = value.trim().length
  const problem = checkModelName(value, namesInUse, { plainOnly })
  const shownProblem = problem === 'empty' && !tried ? null : problem

  const labelElement = (
    <label className={size === 'main' ? undefined : styles.label} htmlFor={fieldId}>
      {label}
    </label>
  )

  return (
    <div>
      {size === 'main' ? <h2>{labelElement}</h2> : labelElement}
      <p id={hintId} className={size === 'main' ? styles.mainHint : styles.hint}>
        {help ? `${help} ` : null}
        {text.hint(maxLength)}
      </p>
      <input
        ref={inputRef}
        id={fieldId}
        className={styles.field}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${hintId} ${countId} ${problemId}`}
        aria-invalid={shownProblem ? true : undefined}
        autoComplete="off"
        spellCheck={false}
        data-autofocus={focusFirst || undefined}
      />
      <div className={styles.below}>
        <p id={problemId} className={styles.problem} role="alert">
          {shownProblem === 'empty' && emptyMessage}
          {shownProblem === 'notPlain' && text.notPlain}
          {shownProblem === 'tooLong' && text.tooLong(used, maxLength)}
          {shownProblem === 'alreadyUsed' && text.alreadyUsed}
        </p>
        <p id={countId} className={used > maxLength ? `${styles.count} ${styles.over}` : styles.count}>
          {text.count(used, maxLength)}
        </p>
      </div>
    </div>
  )
}
