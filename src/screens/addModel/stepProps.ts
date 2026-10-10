import type { DraftProblems, ModelDraft, WizardView } from '../../state/wizard.ts'

/** What every step of the wizard is given. */
export interface StepProps {
  draft: ModelDraft
  view: WizardView
  /** What is still missing or wrong, across all steps. */
  problems: DraftProblems
  /** True once the person has tried to move on from this step. Missing answers are only pointed out then. */
  tried: boolean
  /** Names already on the radio. */
  namesInUse: readonly string[]
  /** Records one or more answers. */
  onChange: (answers: Partial<ModelDraft>) => void
  /** Changes something about the screen that is not an answer, such as the search text. */
  onViewChange: (view: Partial<WizardView>) => void
}
