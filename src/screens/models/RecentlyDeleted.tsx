import { useId } from 'react'
import { Button } from '../../components/Button.tsx'
import { UndoIcon } from '../../components/icons.tsx'
import type { ModelId } from '../../domain/model.ts'
import { strings } from '../../strings/en.ts'
import styles from './RecentlyDeleted.module.css'

/** A deleted model as this list shows it. */
export interface DeletedRow {
  id: ModelId
  name: string
  /** Said quietly beside the name: its receiver type. */
  detail: string
  /** The position it was deleted from. */
  position: number
}

interface RecentlyDeletedProps {
  /** Deleted models, newest first. */
  deleted: readonly DeletedRow[]
  onRestore: (modelId: ModelId) => void
}

const text = strings.recentlyDeleted

/** Lists deleted models, newest first, each with a way to bring it back. */
export function RecentlyDeleted({ deleted, onRestore }: RecentlyDeletedProps) {
  const titleId = useId()

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId}>{text.title}</h2>
      <p className={styles.body}>{text.body}</p>
      <ul className={styles.list}>
        {deleted.map((model) => (
          <li key={model.id} className={styles.row}>
            <span className={styles.name}>{model.name}</span>
            <span className={styles.detail}>{model.detail}</span>
            <span className={styles.was}>{text.wasIn(model.position)}</span>
            <Button icon={<UndoIcon />} aria-label={text.restoreNamed(model.name)} onClick={() => onRestore(model.id)}>
              {text.restore}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
