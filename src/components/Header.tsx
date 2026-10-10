import { strings } from '../strings/en.ts'
import { paths } from '../state/useHashRoute.ts'
import { ButtonLink } from './Button.tsx'
import styles from './Header.module.css'
import { PlugIcon, SetupIcon, WheelMark } from './icons.tsx'

interface HeaderProps {
  /** How many models are on the connected radio, and how many it can hold. Leave out when not connected. */
  connected?: { modelCount: number; maxModels: number }
}

export function Header({ connected }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href={paths.home} className={styles.brand}>
          <span className={styles.mark}>
            <WheelMark />
          </span>
          <span>{strings.appName}</span>
        </a>
        {connected && (
          <>
            <p className={styles.status}>
              <PlugIcon />
              <span>{strings.header.connected(connected.modelCount, connected.maxModels)}</span>
            </p>
            <ButtonLink variant="quiet" href={paths.radioSetup} icon={<SetupIcon />}>
              {strings.header.radioSetup}
            </ButtonLink>
          </>
        )}
      </div>
    </header>
  )
}
