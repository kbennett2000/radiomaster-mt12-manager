import { useSyncExternalStore, type MouseEvent } from 'react'
import { findScenario, SCENARIOS, scenarioHref, type ScenarioGroup } from '../state/scenarios.ts'
import { strings } from '../strings/en.ts'
import { NEXT_SAVE_WAYS, nextSave, type NextSave } from './nextSave.ts'
import styles from './ReviewerPanel.module.css'

const text = strings.review

/**
 * Loads the address as a fresh page, so the jump always starts from the scenario's own state,
 * even when only the part after "#" differs from where the reviewer is now.
 */
function jump(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  const target = new URL(event.currentTarget.href)
  if (target.search === window.location.search) {
    window.location.hash = target.hash
    window.location.reload()
  } else {
    window.location.assign(target)
  }
}

// The panel's columns, and the groups in each, top to bottom. The short groups share a column.
const COLUMNS: readonly (readonly ScenarioGroup[])[] = [
  ['connect', 'realCard'],
  ['cardChanges'],
  ['models'],
  ['delete', 'finish'],
  ['wizard'],
  ['edit'],
]

/**
 * The switch that makes the next save to a made-up card go wrong. It only does anything on a card
 * opened from one of the "Real card" links, so it cannot be used anywhere else.
 */
function NextSaveSwitch({ usable }: { usable: boolean }) {
  const chosen = useSyncExternalStore(nextSave.subscribe, nextSave.get)
  const choices: readonly (NextSave | null)[] = [null, ...NEXT_SAVE_WAYS]

  return (
    <fieldset className={styles.switch} disabled={!usable}>
      <legend className={styles.group}>{text.nextSave.title}</legend>
      {choices.map((way) => (
        <label key={way ?? 'works'} className={styles.choice}>
          <input type="radio" name="review-next-save" checked={chosen === way} onChange={() => nextSave.set(way)} />
          {way === null || way === 'neverEnds' ? text.nextSave.works : text.nextSave.ways[way]}
        </label>
      ))}
      {!usable && <p>{text.nextSave.onlyHere}</p>}
    </fieldset>
  )
}

/**
 * For reviewers only, and not part of the product: one link per state the mockups can be in.
 * It sits as a tab on the right edge of the window and opens into a panel.
 * The screenshot script reads these same links.
 */
export function ReviewerPanel() {
  const activeId = new URLSearchParams(window.location.search).get('state')
  // A made-up card is on screen when the page was opened from a state that has one.
  const onMadeUpCard = findScenario(activeId)?.card !== undefined

  return (
    <details className={styles.panel} data-review-panel>
      <summary className={styles.tab}>{text.tab}</summary>
      <div className={styles.body}>
        {/* The way back to the start sits at the top, so it is in view however long the columns grow. */}
        <div className={styles.top}>
          <p>{text.about}</p>
          <a className={styles.startOver} href={window.location.pathname} onClick={jump}>
            {text.startOver}
          </a>
        </div>
        <div className={styles.groups}>
          {COLUMNS.map((groups) => (
            <div key={groups[0]} className={styles.column} data-column={groups[0]}>
              {groups.map((group) => (
                <section key={group} data-group={group}>
                  <h2 className={styles.group}>{text.groups[group]}</h2>
                  <ul className={styles.links}>
                    {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => (
                      <li key={scenario.id}>
                        <a
                          href={scenarioHref(scenario)}
                          data-review-state={scenario.id}
                          data-review-group={scenario.group}
                          aria-current={scenario.id === activeId ? 'page' : undefined}
                          onClick={jump}
                        >
                          {text.scenarios[scenario.id]}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {group === 'cardChanges' && <NextSaveSwitch usable={onMadeUpCard} />}
                </section>
              ))}
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
