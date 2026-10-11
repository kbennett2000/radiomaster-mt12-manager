import { paths } from '../../state/useHashRoute.ts'
import { modelFrom } from '../../state/wizard.ts'
import { strings } from '../../strings/en.ts'
import { ControlsSection, ModelSummary, PictureSection, PortsSection } from './ModelSummary.tsx'
import styles from './ReviewStep.module.css'
import type { StepProps } from './stepProps.ts'
import stepStyles from './steps.module.css'

const text = strings.addModel.review

/**
 * Step 6: everything that was answered, with a way back to each step. Below the summary it turns
 * the answers round two ways: what each control on the radio does, and what plugs into each
 * receiver port.
 */
export function ReviewStep({ draft, baseFitting, onViewChange }: StepProps) {
  // The same model "Add to my radio" will add, built here only to describe it.
  const features = modelFrom(draft, 'review', draft.position)?.features ?? []

  return (
    <div className={stepStyles.step}>
      <h2>{text.title}</h2>
      <ModelSummary
        draft={draft}
        changeLink={(part, extraId) => ({
          href: paths.addStep(part),
          // "Change" beside an extra opens step 4 with that extra open. From "Extras: None" none is.
          onClick: part === 'extras' ? () => onViewChange({ openExtraId: extraId ?? null }) : undefined,
        })}
      />
      <PictureSection features={features} baseFitting={baseFitting} heading="h3" />
      <ControlsSection features={features} baseFitting={baseFitting} heading="h3" />
      <PortsSection features={features} heading="h3" />
      <p className={styles.afterThis}>{text.afterThis}</p>
    </div>
  )
}
