import type { MouseEvent } from 'react'
import { ButtonLink } from '../../components/Button.tsx'
import { CheckIcon, DownIcon, EditIcon } from '../../components/icons.tsx'
import type { CardReading } from '../../files/card.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './CurrentModelStrip.module.css'
import { placeRowId, scrollToRow } from './rowId.ts'

const text = strings.card

/** Scrolls the row for a position into the middle of the window and puts keyboard focus on it. */
function showRow(event: MouseEvent, position: number) {
  event.preventDefault()
  scrollToRow(placeRowId(position))?.focus({ preventScroll: true })
}

/**
 * Says which model a real card's radio is set to, with a way to its Edit page when the app could
 * read it. The radio can be set to a place with no model in it, and then the strip says that
 * plainly. When the settings do not name a place at all there is no strip, and a line above the
 * list says why.
 */
export function CardCurrentStrip({ reading }: { reading: CardReading }) {
  const position = reading.currentPosition
  if (position === null) return null
  const model = reading.models.find((candidate) => candidate.position === position)

  let words: string
  if (!model) words = text.currentEmpty(position)
  else if (model.name) words = strings.models.currentStrip(model.name, position)
  else words = text.currentUnnamed(position)

  return (
    <div className={styles.strip}>
      <span className={styles.icon}>
        <CheckIcon />
      </span>
      <p className={styles.words}>{words}</p>
      {model && model.name !== null && (
        <ButtonLink
          size="small"
          href={paths.editModel(placeRowId(position))}
          icon={<EditIcon />}
          aria-label={strings.models.editNamed(model.name || text.unnamed(position))}
        >
          {strings.models.edit}
        </ButtonLink>
      )}
      {model && (
        // A link, because it takes you somewhere on the page. It stays on this screen.
        <a className={styles.show} href={paths.home} onClick={(event) => showRow(event, position)}>
          <DownIcon />
          <span>{strings.models.showInList}</span>
        </a>
      )}
    </div>
  )
}
