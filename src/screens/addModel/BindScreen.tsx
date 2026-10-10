import { ButtonLink } from '../../components/Button.tsx'
import { BackIcon, EjectIcon } from '../../components/icons.tsx'
import type { Model } from '../../domain/model.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import styles from './BindScreen.module.css'
import stepStyles from './steps.module.css'
import { WizardFrame } from './WizardFrame.tsx'

const text = strings.addModel.bind

/**
 * The steps for binding a receiver to a model, numbered. The wording is a placeholder until it
 * has been checked on a real radio.
 */
export function BindSteps({ modelName }: { modelName: string }) {
  return (
    <ol className={styles.steps}>
      {text.steps(modelName).map((step, index) => (
        <li key={step} className={styles.step}>
          <span className={styles.number} aria-hidden="true">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Step 7, the last page of the wizard: how to bind the receiver. The model is already in the list
 * when this shows, so there is nothing here to lose and no question on the way out.
 */
export function BindScreen({ model }: { model: Model }) {
  return (
    <WizardFrame shown="bind" where={text.added(model.name, model.position)}>
      <div className={stepStyles.step}>
        <div>
          <h2>{text.title}</h2>
          <p className={stepStyles.intro}>{text.intro}</p>
        </div>
        <BindSteps modelName={model.name} />
        <div className={styles.actions}>
          <ButtonLink variant="primary" size="large" icon={<BackIcon />} href={paths.home}>
            {text.backToModels}
          </ButtonLink>
          <ButtonLink size="large" icon={<EjectIcon />} href={paths.finish}>
            {text.finishAndUnplug}
          </ButtonLink>
        </div>
      </div>
    </WizardFrame>
  )
}
