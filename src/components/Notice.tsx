import { useEffect, useRef, type ReactNode } from 'react'
import { CheckIcon } from './icons.tsx'
import styles from './Notice.module.css'

interface NoticeProps {
  title: string
  children: ReactNode
  /** Buttons that belong to the message, such as Undo. */
  actions?: ReactNode
  /** Changes whenever there is a new message to announce. */
  announceKey: unknown
}

/**
 * A calm confirmation shown after a change. It takes keyboard focus each time a new message
 * appears, so the message is read out and its buttons are the next stop. Taking focus does not
 * scroll the page: whoever shows the notice keeps it in view, so the person keeps their place.
 */
export function Notice({ title, children, actions, announceKey }: NoticeProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [announceKey])

  return (
    <div ref={ref} className={styles.notice} tabIndex={-1}>
      <span className={styles.icon}>
        <CheckIcon />
      </span>
      <div className={styles.words}>
        <p className={styles.title}>{title}</p>
        <p>{children}</p>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
