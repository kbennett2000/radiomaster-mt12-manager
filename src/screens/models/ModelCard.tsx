import { useId } from 'react'
import { Button, ButtonLink } from '../../components/Button.tsx'
import { CheckIcon, CopyIcon, EditIcon, TrashIcon } from '../../components/icons.tsx'
import type { Model } from '../../domain/model.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './ModelCard.module.css'
import { summarizeModel } from './summarizeModel.ts'

interface ModelCardProps {
  model: Model
  /** True for the one model the radio is currently set to. */
  isCurrent: boolean
  onCopy: () => void
  onDelete: () => void
}

export function ModelCard({ model, isCurrent, onCopy, onDelete }: ModelCardProps) {
  const nameId = useId()
  const summary = summarizeModel(model)
  const text = strings.models

  return (
    <li className={isCurrent ? `${styles.card} ${styles.current}` : styles.card}>
      <article className={styles.content} aria-labelledby={nameId}>
        <h2 id={nameId} className={styles.name}>
          {model.name}
        </h2>
        {isCurrent && (
          <p className={styles.badge}>
            <CheckIcon />
            <span>{text.currentBadge}</span>
          </p>
        )}
        <p className={styles.summary}>{summary.features}</p>
        {summary.feedback && <p className={styles.detail}>{summary.feedback}</p>}
        <dl className={styles.facts}>
          <dt>{text.receiverType}</dt>
          <dd>{strings.receiverTypes[model.receiverTypeId]}</dd>
        </dl>
        <div className={styles.actions}>
          <ButtonLink
            variant="quiet"
            href={paths.editModel(model.id)}
            icon={<EditIcon />}
            aria-label={text.editNamed(model.name)}
          >
            {text.edit}
          </ButtonLink>
          <Button variant="quiet" icon={<CopyIcon />} aria-label={text.copyNamed(model.name)} onClick={onCopy}>
            {text.copy}
          </Button>
          <Button variant="quiet" icon={<TrashIcon />} aria-label={text.deleteNamed(model.name)} onClick={onDelete}>
            {text.delete}
          </Button>
        </div>
      </article>
    </li>
  )
}
