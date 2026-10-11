import { RADIO_SETTINGS_PATH, type CardReading } from '../../files/card.ts'
import type { Notice } from '../../state/appState.ts'
import { strings } from '../../strings/en.ts'
import { CardCurrentStrip } from './CardCurrentStrip.tsx'
import { CardModelList } from './CardModelList.tsx'
import styles from './ModelsScreen.module.css'
import { RadioSetupNotice } from './RadioSetupNotice.tsx'

interface CardModelsScreenProps {
  /** What was read from the card. */
  reading: CardReading
  /** The confirmation to show. On a real card only a change to Radio setup can leave one. */
  notice: Notice | null
  onNoticeDismissed: () => void
}

const text = strings.card

/** What is wrong with the radio's settings file, one plain line for each thing. Usually nothing. */
function settingsProblems(reading: CardReading): string[] {
  const refused = reading.refused.find((file) => file.path === RADIO_SETTINGS_PATH)
  if (refused) return [text.settingsNotRead(strings.files.refused[refused.reason](refused.line))]

  const problems: string[] = []
  if (reading.checksum === null) problems.push(text.settingsCheckMissing)
  else if (!reading.checksum.right) problems.push(text.settingsCheckWrong)
  if (reading.currentPosition === null) problems.push(text.settingsNameNoModel)
  return problems
}

/**
 * "Your models" for a real card. This version only reads a card, so the page shows what is on it
 * and has nothing that changes it: no "Add a model", no buttons on the rows and no deleted models.
 */
export function CardModelsScreen({ reading, notice, onNoticeDismissed }: CardModelsScreenProps) {
  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1>{strings.models.title}</h1>
        <p className={styles.hint}>{text.readOnly}</p>
      </div>

      <div className={styles.notice} role="status">
        {notice?.kind === 'radioSetupSaved' && <RadioSetupNotice announceKey={notice} onDismiss={onNoticeDismissed} />}
      </div>

      {settingsProblems(reading).map((problem) => (
        <p key={problem} className={styles.full}>
          {problem}
        </p>
      ))}

      <CardCurrentStrip reading={reading} />
      <CardModelList reading={reading} />
    </div>
  )
}
