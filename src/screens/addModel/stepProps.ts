import type { ExtraAnswers, ExtraKind } from '../../domain/extras.ts'
import type { BaseFitting } from '../../domain/radio.ts'
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
  /** What is fitted on the base of the radio, which decides the controls it has. */
  baseFitting: BaseFitting | null
  /** Records one or more answers. */
  onChange: (answers: Partial<ModelDraft>) => void
  /** Changes something about the screen that is not an answer, such as the search text. */
  onViewChange: (view: Partial<WizardView>) => void
  /** Picks an extra on step 4, which opens its questions. */
  onExtraPicked: (kind: ExtraKind) => void
  /** Takes an extra away again, with its answers. */
  onExtraRemoved: (id: string) => void
  /** Records answers for one extra. */
  onExtraChanged: (id: string, answers: Partial<ExtraAnswers>) => void
}
