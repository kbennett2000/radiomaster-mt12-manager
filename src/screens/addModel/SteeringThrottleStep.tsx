import { useId, type ReactNode } from 'react'
import { Pills } from '../../components/Pills.tsx'
import { MT12, RECEIVER_PORTS } from '../../domain/catalog.ts'
import type { ExtraAnswers } from '../../domain/extras.ts'
import type { Direction } from '../../domain/model.ts'
import type { PercentRange } from '../../domain/radio.ts'
import { throttleFeelOf, type OfferedThrottleFeel } from '../../state/wizard.ts'
import { strings } from '../../strings/en.ts'
import { extraName } from './describe.ts'
import type { StepProps } from './stepProps.ts'
import styles from './SteeringThrottleStep.module.css'
import stepStyles from './steps.module.css'

const text = strings.addModel.steeringThrottle

const directions: readonly Direction[] = ['normal', 'reversed']
const feels: readonly OfferedThrottleFeel[] = ['standard', 'gentle']

interface SettingProps {
  label: string
  help: string
  /** Gives the control, with the ids of the label and the help text so it can point at them. */
  children: (ids: { labelId: string; helpId: string }) => ReactNode
}

/** One setting: its name and a plain explanation on the left, the control on the right. */
function Setting({ label, help, children }: SettingProps) {
  const labelId = useId()
  const helpId = useId()
  return (
    <div className={styles.setting}>
      <div>
        <p id={labelId} className={styles.settingLabel}>
          {label}
        </p>
        <p id={helpId} className={styles.settingHelp}>
          {help}
        </p>
      </div>
      <div className={styles.control}>{children({ labelId, helpId })}</div>
    </div>
  )
}

interface PercentSliderProps {
  ids: { labelId: string; helpId: string }
  range: PercentRange
  value: number
  onChange: (value: number) => void
}

/** A slider that always shows its number. */
function PercentSlider({ ids, range, value, onChange }: PercentSliderProps) {
  return (
    <div className={styles.slider}>
      <input
        type="range"
        className={styles.range}
        min={range.min}
        max={range.max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-labelledby={ids.labelId}
        aria-describedby={ids.helpId}
        aria-valuetext={text.percent(value)}
      />
      <output className={styles.value}>{text.percent(value)}</output>
    </div>
  )
}

interface PortPickerProps {
  label: string
  value: number
  invalid: boolean
  describedBy: string
  /** The extras picked on step 4. A port one of them uses cannot be picked here. */
  extras: readonly ExtraAnswers[]
  onChange: (port: number) => void
}

function PortPicker({ label, value, invalid, describedBy, extras, onChange }: PortPickerProps) {
  const id = useId()
  return (
    <div className={styles.port}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className={styles.portSelect}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      >
        {RECEIVER_PORTS.map((port) => {
          const user = extras.find((extra) => extra.port === port)
          return (
            <option key={port} value={port} disabled={user !== undefined}>
              {user ? text.portTaken(port, extraName(user)) : text.port(port)}
            </option>
          )
        })}
      </select>
    </div>
  )
}

/** Step 3: how the vehicle steers and how the trigger drives it. */
export function SteeringThrottleStep({ draft, view, problems, onChange, onViewChange }: StepProps) {
  const steeringId = useId()
  const throttleId = useId()
  const portsHelpId = useId()
  const portsProblemId = useId()
  const samePort = problems.ports !== null

  return (
    <div className={stepStyles.step}>
      <section className={styles.section} aria-labelledby={steeringId}>
        <h2 id={steeringId}>{text.steering}</h2>
        <Setting label={text.steeringDirection} help={text.steeringDirectionHelp(draft.vehicleKind)}>
          {(ids) => (
            <Pills
              labelledBy={ids.labelId}
              describedBy={ids.helpId}
              options={directions.map((value) => ({ value, label: text.directions[value] }))}
              value={draft.steeringDirection}
              onChange={(steeringDirection) => onChange({ steeringDirection })}
            />
          )}
        </Setting>
        <Setting label={text.travel(draft.vehicleKind)} help={text.travelHelp}>
          {(ids) => (
            <PercentSlider
              ids={ids}
              range={MT12.steeringTravel}
              value={draft.steeringTravel}
              onChange={(steeringTravel) => onChange({ steeringTravel })}
            />
          )}
        </Setting>
      </section>

      <section className={styles.section} aria-labelledby={throttleId}>
        <h2 id={throttleId}>{text.throttle}</h2>
        <Setting label={text.throttleDirection} help={text.throttleDirectionHelp(draft.vehicleKind)}>
          {(ids) => (
            <Pills
              labelledBy={ids.labelId}
              describedBy={ids.helpId}
              options={directions.map((value) => ({ value, label: text.directions[value] }))}
              value={draft.throttleDirection}
              onChange={(throttleDirection) => onChange({ throttleDirection })}
            />
          )}
        </Setting>
        <Setting label={text.feel} help={text.feelHelp}>
          {(ids) => (
            <Pills
              labelledBy={ids.labelId}
              describedBy={ids.helpId}
              options={feels.map((value) => ({ value, label: text.feels[value] }))}
              value={throttleFeelOf(draft)}
              onChange={(throttleFeel) => onChange({ throttleFeel })}
            />
          )}
        </Setting>
        <Setting label={text.topSpeed} help={text.topSpeedHelp}>
          {(ids) => (
            <PercentSlider
              ids={ids}
              range={MT12.topSpeed}
              value={draft.topSpeed}
              onChange={(topSpeed) => onChange({ topSpeed })}
            />
          )}
        </Setting>
      </section>

      {/*
        Opening and closing is done here, not left to the browser, so that it stays open while the
        two ports clash and the message about that can never be hidden.
      */}
      <details className={styles.more} open={view.moreOptionsOpen || samePort}>
        <summary
          className={styles.moreSummary}
          onClick={(event) => {
            event.preventDefault()
            if (!samePort) onViewChange({ moreOptionsOpen: !view.moreOptionsOpen })
          }}
        >
          {text.moreOptions}
        </summary>
        <div className={styles.setting}>
          <div>
            <p className={styles.settingLabel}>{text.ports}</p>
            <p id={portsHelpId} className={styles.settingHelp}>
              {text.portsHelp}
            </p>
          </div>
          <div className={styles.control}>
            <div className={styles.ports}>
              <PortPicker
                label={text.steeringPort}
                value={draft.steeringPort}
                invalid={samePort}
                extras={draft.extras}
                describedBy={`${portsHelpId} ${portsProblemId}`}
                onChange={(steeringPort) => onChange({ steeringPort })}
              />
              <PortPicker
                label={text.throttlePort}
                value={draft.throttlePort}
                invalid={samePort}
                extras={draft.extras}
                describedBy={`${portsHelpId} ${portsProblemId}`}
                onChange={(throttlePort) => onChange({ throttlePort })}
              />
            </div>
            <p id={portsProblemId} className={stepStyles.problem} role="alert">
              {samePort ? text.samePort(draft.steeringPort) : null}
            </p>
          </div>
        </div>
      </details>
    </div>
  )
}
