import { strings } from '../strings/en.ts'
import { paths } from '../state/useHashRoute.ts'
import { ButtonLink } from './Button.tsx'
import styles from './Header.module.css'
import { EjectIcon, PlugIcon, SetupIcon, WheelMark } from './icons.tsx'

interface HeaderProps {
  /**
   * How many models there are, and how many the radio can hold. `sample` is true when they are the
   * sample models and not a real card's. Leave out when not connected.
   */
  connected?: { modelCount: number; maxModels: number; sample: boolean }
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
              <span>
                {connected.sample
                  ? strings.header.sample(connected.modelCount, connected.maxModels)
                  : strings.header.connected(connected.modelCount, connected.maxModels)}
              </span>
            </p>
            <nav className={styles.actions}>
              <ButtonLink variant="quiet" href={paths.radioSetup} icon={<SetupIcon />}>
                {strings.header.radioSetup}
              </ButtonLink>
              <ButtonLink variant="quiet" href={paths.finish} icon={<EjectIcon />}>
                {strings.header.finishAndUnplug}
              </ButtonLink>
            </nav>
          </>
        )}
      </div>
    </header>
  )
}
