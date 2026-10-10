import { useId } from 'react'
import { Button } from '../../components/Button.tsx'
import { UndoIcon } from '../../components/icons.tsx'
import type { DeletedModel, ModelId } from '../../domain/model.ts'
import { strings } from '../../strings/en.ts'
import styles from './RecentlyDeleted.module.css'

interface RecentlyDeletedProps {
  deleted: readonly DeletedModel[]
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
        {deleted.map(({ model }) => (
          <li key={model.id} className={styles.row}>
            <span className={styles.name}>{model.name}</span>
            <span className={styles.receiver}>{strings.receiverTypes[model.receiverTypeId]}</span>
            <Button icon={<UndoIcon />} aria-label={text.restoreNamed(model.name)} onClick={() => onRestore(model.id)}>
              {text.restore}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
