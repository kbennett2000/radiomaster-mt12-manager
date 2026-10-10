import { ButtonLink } from '../../components/Button.tsx'
import { BackIcon } from '../../components/icons.tsx'
import type { Model } from '../../domain/model.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import { BindSteps } from '../addModel/BindScreen.tsx'
import styles from './EditModel.module.css'

const text = strings.editModel.bind

/**
 * How to bind a model's receiver again, after the receiver was changed. The steps are the same
 * ones the wizard ends on.
 */
export function RebindScreen({ model }: { model: Model }) {
  return (
    <div className={styles.page}>
      <div>
        <h1>{text.title}</h1>
        <p className={styles.intro}>{strings.addModel.bind.intro}</p>
      </div>
      <BindSteps modelName={model.name} />
      <div>
        <ButtonLink variant="primary" size="large" icon={<BackIcon />} href={paths.editModel(model.id)}>
          {text.backTo(model.name)}
        </ButtonLink>
      </div>
    </div>
  )
}
