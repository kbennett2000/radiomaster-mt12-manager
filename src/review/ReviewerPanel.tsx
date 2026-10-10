import type { MouseEvent } from 'react'
import { SCENARIO_GROUPS, SCENARIOS, scenarioHref } from '../state/scenarios.ts'
import { strings } from '../strings/en.ts'
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

/**
 * For reviewers only, and not part of the product: one link per state the mockups can be in.
 * It sits as a tab on the right edge of the window and opens into a panel.
 * The screenshot script reads these same links.
 */
export function ReviewerPanel() {
  const activeId = new URLSearchParams(window.location.search).get('state')

  return (
    <details className={styles.panel} data-review-panel>
      <summary className={styles.tab}>{text.tab}</summary>
      <div className={styles.body}>
        <p>{text.about}</p>
        <div className={styles.groups}>
          {SCENARIO_GROUPS.map((group) => (
            <section key={group}>
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
            </section>
          ))}
        </div>
        <a className={styles.startOver} href={window.location.pathname} onClick={jump}>
          {text.startOver}
        </a>
      </div>
    </details>
  )
}
