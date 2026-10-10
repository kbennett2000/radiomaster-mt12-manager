import { useId } from 'react'
import { Button } from '../../components/Button.tsx'
import { CheckIcon } from '../../components/icons.tsx'
import { RECEIVER_TYPES, type BrandId } from '../../domain/catalog.ts'
import { strings } from '../../strings/en.ts'
import { matchesSearch } from './receiverSearch.ts'
import styles from './ReceiverStep.module.css'
import type { StepProps } from './stepProps.ts'
import stepStyles from './steps.module.css'

const text = strings.addModel.receiver

/** The brands in the order their first receiver is listed. */
const brands = [...new Set(RECEIVER_TYPES.map((receiver) => receiver.brand))] as BrandId[]

/** Step 2: which receiver is in the vehicle, found by searching or by reading down the list. */
export function ReceiverStep({ draft, view, problems, tried, onChange, onViewChange }: StepProps) {
  const searchId = useId()
  const groupName = useId()
  const panelId = useId()

  const matching = RECEIVER_TYPES.filter((receiver) =>
    matchesSearch(view.search, [
      strings.brands[receiver.brand],
      strings.receiverLabels[receiver.id],
      strings.receiverTypes[receiver.id],
    ]),
  )

  return (
    <div className={stepStyles.step}>
      <div>
        <h2>{text.question}</h2>
        <p className={stepStyles.intro}>{text.intro}</p>
      </div>

      <div className={styles.finder}>
        <div>
          <label className={styles.searchLabel} htmlFor={searchId}>
            {text.searchLabel}
          </label>
          <input
            id={searchId}
            className={styles.search}
            type="search"
            value={view.search}
            onChange={(event) => onViewChange({ search: event.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* How many receivers are listed, and which one is picked. The pick stays in view when a search hides it. */}
        <div className={styles.status} role="status">
          <p className={styles.count}>
            {matching.length > 0 ? text.count(matching.length, RECEIVER_TYPES.length) : null}
          </p>
          {draft.receiverTypeId && (
            <p className={styles.picked}>
              <CheckIcon />
              <span>{text.picked(strings.receiverTypes[draft.receiverTypeId])}</span>
            </p>
          )}
        </div>

        <fieldset className={styles.list}>
          <legend className="visually-hidden">{text.listLabel}</legend>
          {matching.length === 0 && <p className={styles.nothing}>{text.nothingMatches(view.search.trim())}</p>}
          {brands.map((brand) => {
            const receivers = matching.filter((receiver) => receiver.brand === brand)
            if (receivers.length === 0) return null
            return (
              <div key={brand} className={styles.brand} role="group" aria-label={strings.brands[brand]}>
                <p className={styles.brandName} aria-hidden="true">
                  {strings.brands[brand]}
                </p>
                <div>
                  {receivers.map((receiver) => (
                    <label key={receiver.id} className={styles.entry}>
                      <input
                        type="radio"
                        className={styles.radio}
                        name={groupName}
                        value={receiver.id}
                        checked={draft.receiverTypeId === receiver.id}
                        onChange={() => onChange({ receiverTypeId: receiver.id })}
                      />
                      <span className={styles.label}>{strings.receiverLabels[receiver.id]}</span>
                      <span className={styles.typeName}>{strings.receiverTypes[receiver.id]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </fieldset>

        <p className={stepStyles.problem} role="alert">
          {tried && problems.receiver ? text.missing : null}
        </p>
      </div>

      <div>
        <button
          type="button"
          className={styles.cantFind}
          aria-expanded={view.cantFindOpen}
          aria-controls={panelId}
          onClick={() => onViewChange({ cantFindOpen: !view.cantFindOpen })}
        >
          {text.cantFind}
        </button>
        <div id={panelId} className={styles.panel} hidden={!view.cantFindOpen}>
          <h3>{text.cantFindTitle}</h3>
          <p>{text.cantFindBody}</p>
          <Button size="small" onClick={() => onViewChange({ cantFindOpen: false })}>
            {text.cantFindClose}
          </Button>
        </div>
      </div>
    </div>
  )
}
