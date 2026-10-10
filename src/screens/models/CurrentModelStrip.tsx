import type { MouseEvent } from 'react'
import { ButtonLink } from '../../components/Button.tsx'
import { CheckIcon, DownIcon, EditIcon } from '../../components/icons.tsx'
import type { Model } from '../../domain/model.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './CurrentModelStrip.module.css'
import { scrollToRow } from './rowId.ts'

const text = strings.models

/** Scrolls the model's row into the middle of the window and puts keyboard focus on it. */
function showRow(event: MouseEvent, model: Model) {
  event.preventDefault()
  scrollToRow(model.id)?.focus({ preventScroll: true })
}

/** Says which model the radio is set to, so nobody has to hunt through the list for it. */
export function CurrentModelStrip({ model }: { model: Model }) {
  return (
    <div className={styles.strip}>
      <span className={styles.icon}>
        <CheckIcon />
      </span>
      <p className={styles.words}>{text.currentStrip(model.name, model.position)}</p>
      <ButtonLink
        size="small"
        href={paths.editModel(model.id)}
        icon={<EditIcon />}
        aria-label={text.editNamed(model.name)}
      >
        {text.edit}
      </ButtonLink>
      {/* A link, because it takes you somewhere on the page. It stays on this screen. */}
      <a className={styles.show} href={paths.home} onClick={(event) => showRow(event, model)}>
        <DownIcon />
        <span>{text.showInList}</span>
      </a>
    </div>
  )
}
