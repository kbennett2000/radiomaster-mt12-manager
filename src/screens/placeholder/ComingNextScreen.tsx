import { ButtonLink } from '../../components/Button.tsx'
import { BackIcon } from '../../components/icons.tsx'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './ComingNextScreen.module.css'

interface ComingNextScreenProps {
  title: string
  body: string
  /** The words on the button that goes back. */
  backLabel: string
}

/** Stands in for a part of the app that a later cycle builds. */
export function ComingNextScreen({ title, body, backLabel }: ComingNextScreenProps) {
  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>{strings.comingNext.eyebrow}</p>
      <h1>{title}</h1>
      <p className={styles.body}>{body}</p>
      <ButtonLink variant="primary" size="large" icon={<BackIcon />} href={paths.home}>
        {backLabel}
      </ButtonLink>
    </div>
  )
}
