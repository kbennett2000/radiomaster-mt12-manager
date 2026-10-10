import { Button } from '../../components/Button.tsx'
import { CheckIcon } from '../../components/icons.tsx'
import { strings } from '../../strings/en.ts'
import styles from './FinishScreen.module.css'

const text = strings.finish

/**
 * The steps to take before unplugging the radio. Reached from "Finish and unplug" in the header.
 * The steps themselves are placeholder wording until they have been checked on a real radio.
 */
export function FinishScreen({ onUnplugged }: { onUnplugged: () => void }) {
  return (
    <div className={styles.page}>
      <h1>{text.title}</h1>
      <ol className={styles.steps}>
        {text.steps.map((step, index) => (
          <li key={step} className={styles.step}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <Button variant="primary" size="large" icon={<CheckIcon />} onClick={onUnplugged}>
        {text.done}
      </Button>
    </div>
  )
}
