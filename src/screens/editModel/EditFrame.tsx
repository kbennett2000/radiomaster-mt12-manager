import type { ReactNode } from 'react'
import type { Model } from '../../domain/model.ts'
import { strings } from '../../strings/en.ts'
import wizardStyles from '../addModel/AddModelScreen.module.css'
import styles from './EditModel.module.css'

const text = strings.editModel

interface EditFrameProps {
  model: Model
  /** True when the radio is set to this model. */
  isCurrent: boolean
  children: ReactNode
}

/** What the Edit page and the page for each part share: the title, and where the model is, said quietly. */
export function EditFrame({ model, isCurrent, children }: EditFrameProps) {
  return (
    <div className={styles.page}>
      <div className={wizardStyles.top}>
        <h1>{text.title(model.name)}</h1>
        <p className={wizardStyles.where}>
          {text.position(model.position)}
          {isCurrent && ` ${text.current}`}
        </p>
      </div>
      {children}
    </div>
  )
}
