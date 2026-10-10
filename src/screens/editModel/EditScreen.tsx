import type { Dispatch } from 'react'
import { ButtonLink } from '../../components/Button.tsx'
import { BackIcon } from '../../components/icons.tsx'
import { leftAloneIn, type LeftAlone } from '../../domain/leftAlone.ts'
import type { Model } from '../../domain/model.ts'
import type { BaseFitting } from '../../domain/radio.ts'
import { isEditChange, type Action, type Notice as Change } from '../../state/appState.ts'
import { draftFrom, type EditPart } from '../../state/edit.ts'
import { goTo, paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import { ControlsSection, ModelSummary, PortsSection, type ChangeLink } from '../addModel/ModelSummary.tsx'
import summaryStyles from '../addModel/ReviewStep.module.css'
import { EditFrame } from './EditFrame.tsx'
import styles from './EditModel.module.css'
import { EditNotice } from './EditNotice.tsx'

const text = strings.editModel

/** The control a setting made on the radio uses, or which kinds of feedback it is, said before its sentence. */
function factAbout(setting: LeftAlone): string | null {
  if (setting.kind === 'modelFeedback') {
    return text.leftAlone.feedbackKinds(setting.feedback.map((kind) => strings.feedback[kind]))
  }
  return 'control' in setting ? strings.controls[setting.control] : null
}

interface EditScreenProps {
  model: Model
  /** True when the radio is set to this model. */
  isCurrent: boolean
  /** What is fitted on the base of the radio, which decides the controls it has. */
  baseFitting: BaseFitting | null
  /** The confirmation of the last change. It is shown here when it is about this model. */
  notice: Change | null
  dispatch: Dispatch<Action>
}

/**
 * Everything about one model that is already on the radio, laid out like the wizard's "Check it
 * over" page. Each answer has a "Change" that opens that one part on a page of its own, which is
 * where saving happens. Settings that were made on the radio are shown too, and left alone.
 */
export function EditScreen({ model, isCurrent, baseFitting, notice, dispatch }: EditScreenProps) {
  const leftAlone = leftAloneIn(model)

  /** The link that opens one part. An extra's own row opens the Extras page with that extra's questions showing. */
  const open = (part: EditPart, openExtraId?: string): ChangeLink => ({
    href: paths.editPart(model.id, part),
    onClick: (event) => {
      // The address is changed first, so the page and the state never disagree for a moment.
      event.preventDefault()
      goTo(paths.editPart(model.id, part))
      dispatch({ type: 'editOpened', modelId: model.id, part, openExtraId })
    },
  })

  return (
    <EditFrame model={model} isCurrent={isCurrent}>
      <div className={styles.notice} role="status">
        {isEditChange(notice) && notice.modelId === model.id && (
          <EditNotice
            notice={notice}
            onUndo={() => dispatch({ type: 'changeUndone' })}
            onDismiss={() => dispatch({ type: 'noticeDismissed' })}
          />
        )}
      </div>

      <ModelSummary
        draft={draftFrom(model)}
        changeLink={open}
        positionNote={text.positionNote}
        extrasLink={<a {...open('extras')}>{text.addOrRemoveExtras}</a>}
        otherFeedback={model.feedback.length > 0 ? text.leftAlone.feedbackRow : null}
      />

      {leftAlone.length > 0 && (
        <section className={summaryStyles.section}>
          <h2 className={summaryStyles.sectionTitle}>{text.leftAlone.title}</h2>
          <p className={summaryStyles.help}>{text.leftAlone.help}</p>
          <dl className={summaryStyles.lines}>
            {leftAlone.map((setting) => {
              const fact = factAbout(setting)
              return (
                <div key={text.leftAlone.name(setting)} className={summaryStyles.line}>
                  <dt className={summaryStyles.lineLabel}>{text.leftAlone.name(setting)}</dt>
                  <dd className={summaryStyles.lineWords}>
                    {fact && <span className={styles.fact}>{fact}</span>}
                    {text.leftAlone.about[setting.kind]}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      )}

      <ControlsSection features={model.features} baseFitting={baseFitting} heading="h2" />
      <PortsSection features={model.features} heading="h2" />

      <div>
        <ButtonLink variant="primary" size="large" icon={<BackIcon />} href={paths.home}>
          {text.backToModels}
        </ButtonLink>
      </div>
    </EditFrame>
  )
}
