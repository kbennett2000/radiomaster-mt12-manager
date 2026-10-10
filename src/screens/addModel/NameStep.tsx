import { PictureChoices } from '../../components/Choices.tsx'
import { VehicleKindDrawing } from '../../components/drawings.tsx'
import { ModelNameField } from '../../components/ModelNameField.tsx'
import { VEHICLE_KINDS } from '../../state/wizard.ts'
import { strings } from '../../strings/en.ts'
import type { StepProps } from './stepProps.ts'
import styles from './steps.module.css'

const text = strings.addModel.name

const kindOptions = VEHICLE_KINDS.map((kind) => ({
  value: kind,
  label: text.kinds[kind],
  picture: <VehicleKindDrawing kind={kind} />,
}))

/**
 * Step 1: what the model is called, and what kind of vehicle it is for. The kind only helps the
 * wizard suggest settings and is not kept with the model, so it is not asked about one being edited.
 */
export function NameStep({ draft, problems, tried, namesInUse, editing, onChange }: StepProps) {
  return (
    <div className={styles.step}>
      <ModelNameField
        label={text.question}
        size="main"
        help={text.help}
        value={draft.name}
        onChange={(name) => onChange({ name })}
        namesInUse={namesInUse}
        emptyMessage={text.empty}
        tried={tried}
      />
      {!editing && (
        <PictureChoices
          question={text.kindQuestion}
          help={text.kindHelp}
          options={kindOptions}
          value={draft.vehicleKind}
          onChange={(vehicleKind) => onChange({ vehicleKind })}
          problem={tried && problems.vehicleKind ? text.kindMissing : null}
        />
      )}
    </div>
  )
}
