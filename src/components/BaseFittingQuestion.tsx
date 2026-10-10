import { MT12 } from '../domain/catalog.ts'
import type { BaseFitting } from '../domain/radio.ts'
import { strings } from '../strings/en.ts'
import { PictureChoices } from './Choices.tsx'
import { BaseFittingDrawing } from './drawings.tsx'

interface BaseFittingQuestionProps {
  value: BaseFitting | null
  onChange: (baseFitting: BaseFitting) => void
  /** True once the person has tried to carry on without choosing. */
  showMissing: boolean
}

const text = strings.baseFitting

const options = MT12.baseFittings.map((fitting) => ({
  value: fitting,
  label: text.options[fitting].label,
  description: text.options[fitting].description,
  picture: <BaseFittingDrawing fitting={fitting} />,
}))

/** Asks what is fitted on the base of the radio, with three picture choices. */
export function BaseFittingQuestion({ value, onChange, showMissing }: BaseFittingQuestionProps) {
  return (
    <PictureChoices
      question={text.question}
      help={text.help}
      options={options}
      value={value}
      onChange={onChange}
      problem={showMissing && !value ? text.chooseFirst : null}
    />
  )
}
