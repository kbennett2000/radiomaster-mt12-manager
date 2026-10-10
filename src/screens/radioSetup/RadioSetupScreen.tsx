import { BaseFittingForm } from '../../components/BaseFittingForm.tsx'
import type { BaseFitting } from '../../domain/radio.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './RadioSetupScreen.module.css'

interface RadioSetupScreenProps {
  baseFitting: BaseFitting | null
  onSave: (baseFitting: BaseFitting) => void
}

/** Lets the owner change what the app knows about their radio. Reached from the header. */
export function RadioSetupScreen({ baseFitting, onSave }: RadioSetupScreenProps) {
  return (
    <div className={styles.page}>
      <h1>{strings.radioSetup.title}</h1>
      <BaseFittingForm
        initial={baseFitting}
        submitLabel={strings.radioSetup.save}
        onSubmit={onSave}
        secondary={
          <a className={styles.back} href={paths.home}>
            {strings.radioSetup.back}
          </a>
        }
      />
    </div>
  )
}
