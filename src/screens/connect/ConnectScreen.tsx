import { BaseFittingForm } from '../../components/BaseFittingForm.tsx'
import { Button, ButtonLink } from '../../components/Button.tsx'
import { PickDriveDrawing, PlugInCableDrawing, RadioScreenDrawing } from '../../components/drawings.tsx'
import { AlertIcon, CheckIcon, PlugIcon, SpinnerIcon } from '../../components/icons.tsx'
import type { BaseFitting } from '../../domain/radio.ts'
import type { AppState } from '../../state/appState.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './ConnectScreen.module.css'

interface ConnectScreenProps {
  state: AppState
  onConnect: () => void
  onBaseFittingAnswered: (baseFitting: BaseFitting) => void
}

const text = strings.connect

function StepDrawing({ step }: { step: number }) {
  if (step === 0) return <PlugInCableDrawing />
  if (step === 1) return <RadioScreenDrawing choice={text.radioMenuChoice} />
  return <PickDriveDrawing />
}

export function ConnectScreen({ state, onConnect, onBaseFittingAnswered }: ConnectScreenProps) {
  if (state.connection === 'connected') {
    return (
      <div className={styles.page}>
        <p className={styles.connected}>
          <CheckIcon />
          <span>{text.connected.found(state.models.length)}</span>
        </p>
        <h1>{text.connected.title}</h1>
        <p className={styles.intro}>{text.connected.oneQuestion}</p>
        <div className={styles.question}>
          <BaseFittingForm
            initial={null}
            submitLabel={text.connected.continue}
            onSubmit={onBaseFittingAnswered}
            saysItCanChangeLater
          />
        </div>
      </div>
    )
  }

  if (!state.browserSupported) {
    return (
      <div className={`${styles.page} ${styles.narrow}`}>
        <h1>{text.unsupported.title}</h1>
        <p className={styles.intro}>{text.unsupported.why}</p>
        <p className={styles.intro}>{text.unsupported.whatNow}</p>
        <div className={styles.actions}>
          <ButtonLink variant="primary" size="large" href={paths.openFiles}>
            {text.openFilesLink}
          </ButtonLink>
        </div>
      </div>
    )
  }

  const connecting = state.connection === 'connecting'
  const wrongFolder = state.connection === 'wrongFolder'

  return (
    <div className={styles.page}>
      <h1>{text.title}</h1>
      {wrongFolder ? (
        <div className={styles.problem} role="alert">
          <span className={styles.problemIcon}>
            <AlertIcon />
          </span>
          <div>
            <h2 className={styles.problemTitle}>{text.wrongFolder.title}</h2>
            <p>{text.wrongFolder.body}</p>
          </div>
        </div>
      ) : (
        <p className={styles.intro}>{text.intro}</p>
      )}

      <ol className={styles.steps}>
        {text.steps.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <div className={styles.picture}>
              <StepDrawing step={index} />
            </div>
            <h2 className={styles.stepTitle}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <span className={styles.srOnly}>{text.stepNumber(index + 1)}: </span>
                {step.title}
              </span>
            </h2>
            <p className={styles.stepBody}>{step.body}</p>
          </li>
        ))}
      </ol>

      <div className={styles.actions}>
        <Button
          variant="primary"
          size="large"
          icon={connecting ? <SpinnerIcon /> : <PlugIcon />}
          aria-disabled={connecting || undefined}
          onClick={connecting ? undefined : onConnect}
        >
          {connecting ? text.connecting.button : wrongFolder ? text.wrongFolder.retry : text.connectButton}
        </Button>
        <p className={styles.status} role="status">
          {connecting ? text.connecting.status : null}
        </p>
        {!connecting && (
          <a className={styles.quietLink} href={paths.openFiles}>
            {text.openFilesLink}
          </a>
        )}
      </div>
    </div>
  )
}
