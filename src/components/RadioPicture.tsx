// A labeled picture of the radio: two line drawings, with every control named and what it does on
// a model.
//
// The drawings are my own simplified line art. They are not copies or tracings of anyone's
// pictures. Each is drawn on a grid of units, 300 across, and has a dot on every control.
//
// The labels are ordinary text beside the drawings, not part of them, so a long label wraps like
// any other text. They are stacked in columns, which is what keeps one from ever overlapping
// another, or the drawing. Each label's line is drawn afterwards, from where the label ended up
// to the dot on its control, and drawn again whenever the picture changes size.

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { BaseFitting, ControlId } from '../domain/radio.ts'
import { listOf, strings } from '../strings/en.ts'
import drawing from './drawings.module.css'
import styles from './RadioPicture.module.css'

const text = strings.addModel.review

/** One control and the short names of the jobs it does on the model. No jobs means it is not used. */
export interface PictureControl {
  control: ControlId
  jobs: readonly string[]
}

/** The two drawings: the radio from the driver's side, and the side that faces away. */
type View = 'main' | 'otherSide'

/**
 * Where a label sits. Most are in a column to the left or right of their drawing. Two sit above
 * the main drawing, one on each side of the gap between the face and the wheel, so that their
 * lines can drop straight down through that gap.
 */
type Region = 'left' | 'right' | 'aboveLeft' | 'aboveRight'

interface Place {
  view: View
  region: Region
  /** For a label in a column: how far down the drawing it would like to start, in units. */
  top: number
}

// The split of the main drawing, in units from its left edge: the gap between the face and the wheel.
const GAP_AT = 174
const DRAWING_WIDTH = 300

// Each label is placed so that its line reaches its dot without crossing a busy part of the
// drawing, or another line. The controls a base fitting adds are placeholders, like their names:
// I have not checked where they sit against a real radio with these fitted.
const PLACES: Record<ControlId, Place> = {
  P2: { view: 'main', region: 'aboveLeft', top: 0 },
  T1: { view: 'main', region: 'aboveRight', top: 0 },
  T2: { view: 'main', region: 'right', top: 2 },
  P1: { view: 'main', region: 'right', top: 52 },
  wheel: { view: 'main', region: 'right', top: 100 },
  T5: { view: 'main', region: 'right', top: 160 },
  baseSwitchLeft: { view: 'main', region: 'right', top: 204 },
  baseSwitchRight: { view: 'main', region: 'right', top: 252 },
  joystickUpDown: { view: 'main', region: 'right', top: 204 },
  joystickLeftRight: { view: 'main', region: 'right', top: 252 },
  T4: { view: 'main', region: 'left', top: 176 },
  SA: { view: 'main', region: 'left', top: 214 },
  SC: { view: 'main', region: 'left', top: 252 },
  SD: { view: 'main', region: 'left', top: 304 },
  T3: { view: 'otherSide', region: 'left', top: 104 },
  SB: { view: 'otherSide', region: 'left', top: 134 },
  trigger: { view: 'otherSide', region: 'right', top: 72 },
}

/** A length on the drawing's grid, as a CSS length that grows with the text size. */
const units = (count: number): string => `calc(var(--radio-picture-unit) * ${count})`

interface Entry extends PictureControl {
  place: Place
  used: boolean
}

/** One label: the name printed by the control, then what it does on the model. */
function Label({ entry, style }: { entry: Entry; style?: CSSProperties }) {
  const { control, jobs, used, place } = entry
  // Nothing is printed on the wheel or the trigger, so they go by their job alone.
  const mark = strings.controlMarks[control] ?? (used ? null : strings.controls[control])
  return (
    <p
      className={styles.label}
      data-control-label={control}
      data-region={place.region}
      data-used={used || undefined}
      style={style}
    >
      {mark && (
        <>
          <span className={styles.mark}>{mark}</span>
          {text.pictureLabelJoin}
        </>
      )}
      {used ? listOf(jobs) : text.notUsed}
    </p>
  )
}

/**
 * A column of labels beside a drawing. Each starts level with its control when there is room.
 * A label that wraps onto more lines pushes the ones below it down, so two never overlap.
 */
function Column({ side, entries }: { side: 'left' | 'right'; entries: readonly Entry[] }) {
  const mine = entries.filter((entry) => entry.place.region === side).toSorted((a, b) => a.place.top - b.place.top)
  return (
    <div className={styles.column} data-side={side}>
      {mine.map((entry, index) => {
        const next = mine[index + 1]
        return (
          <Label
            key={entry.control}
            entry={entry}
            style={{
              marginTop: index === 0 ? units(entry.place.top) : undefined,
              minHeight: next ? units(next.place.top - entry.place.top) : undefined,
            }}
          />
        )
      })}
    </div>
  )
}

/** A line from a label to the dot on its control, in pixels from the corner of the picture. */
interface Leader {
  control: ControlId
  used: boolean
  x1: number
  y1: number
  x2: number
  y2: number
}

// How far a line starts from the words of its label, in pixels: beside them for a label in a
// column, and under them for a label above the drawing.
const BESIDE = 6
const UNDER = 2

/** Where the lines run, measured from the labels and dots as they are laid out right now. */
function measure(picture: HTMLElement): Leader[] {
  const corner = picture.getBoundingClientRect()
  return [...picture.querySelectorAll<HTMLElement>('[data-control-label]')].flatMap((label) => {
    const control = label.dataset.controlLabel as ControlId
    const dot = picture.querySelector(`[data-control-dot="${control}"]`)?.getBoundingClientRect()
    if (!dot) return []
    // The words sit inside the label's box, with some room kept clear around them.
    const style = getComputedStyle(label)
    const room = (side: 'paddingLeft' | 'paddingRight' | 'paddingBottom') => parseFloat(style[side]) || 0
    const box = label.getBoundingClientRect()
    const wordsLeft = box.left + room('paddingLeft')
    const wordsRight = box.right - room('paddingRight')
    const wordsBottom = box.bottom - room('paddingBottom')
    const firstLine = Math.min(parseFloat(style.lineHeight) || box.height, box.height)
    const dotX = dot.left + dot.width / 2
    // A label in a column is joined at the middle of its first line. One above the drawing is
    // joined from underneath, straight above its dot, so its line drops straight down.
    const starts: Record<Region, [number, number]> = {
      left: [wordsRight + BESIDE, box.top + firstLine / 2],
      right: [wordsLeft - BESIDE, box.top + firstLine / 2],
      aboveLeft: [Math.min(Math.max(dotX, box.left), box.right), wordsBottom + UNDER],
      aboveRight: [Math.min(Math.max(dotX, box.left), box.right), wordsBottom + UNDER],
    }
    const [startX, startY] = starts[label.dataset.region as Region]
    return [
      {
        control,
        used: label.dataset.used !== undefined,
        x1: startX - corner.left,
        y1: startY - corner.top,
        x2: dotX - corner.left,
        y2: dot.top + dot.height / 2 - corner.top,
      },
    ]
  })
}

interface DrawingProps {
  /** The props that draw a control strongly when the model uses it, and quietly when it does not. */
  tone: (control: ControlId) => { 'data-used': true | undefined }
  /** The dot on a control, where its line ends. */
  dot: (control: ControlId, x: number, y: number) => ReactNode
}

/**
 * The radio from the driver's side, as it is held: the face, the wheel with the tabs and dials
 * round it, the grip, and the base. The keys on the face are drawn but have no labels.
 */
function MainDrawing({ tone, dot, fitting }: DrawingProps & { fitting: BaseFitting }) {
  return (
    <svg className={styles.drawing} viewBox="0 0 300 340" aria-hidden="true" focusable="false" data-radio-drawing>
      {/* the base: its long side, its top, and the end that faces the driver */}
      <path className={drawing.body} d="M118 288L288 240V286L118 334Z" />
      <path className={drawing.body} d="M30 288H118L288 240H200Z" />
      <rect className={drawing.body} x="30" y="288" width="88" height="46" rx="8" />
      {/* the charging port, with the SD button under it */}
      <rect className={drawing.thin} x="58" y="296" width="32" height="8" rx="4" />
      <rect className={styles.control} {...tone('SD')} x="50" y="312" width="48" height="14" rx="5" />

      {/*
        The cover on top of the base, where two switches or the joystick fit. Where these sit, and
        what they look like, is a placeholder: I have not seen a radio with them fitted.
      */}
      <path className={drawing.sunken} d="M155 260H210L272 242H218Z" />
      {fitting === 'twoSwitches' && (
        <>
          <ellipse className={styles.control} {...tone('baseSwitchLeft')} cx="205" cy="251" rx="7" ry="4" />
          <path className={styles.lever} {...tone('baseSwitchLeft')} d="M205 250l-4-13" />
          <ellipse className={styles.control} {...tone('baseSwitchRight')} cx="233" cy="251" rx="7" ry="4" />
          <path className={styles.lever} {...tone('baseSwitchRight')} d="M233 250l4-13" />
        </>
      )}
      {fitting === 'joystick' && (
        <>
          <ellipse className={styles.control} {...tone('joystickLeftRight')} cx="219" cy="251" rx="14" ry="6" />
          <path className={styles.lever} {...tone('joystickUpDown')} d="M219 250v-11" />
          <circle className={styles.control} {...tone('joystickUpDown')} cx="219" cy="236" r="5" />
        </>
      )}

      {/* the grip, standing on the base. Its top is behind the face and the wheel. */}
      <path className={drawing.body} d="M112 120H200L167 268L116 282H68Z" />

      {/* the far side of the wheel: the P1 dial, and the T2 tab showing above the wheel */}
      <rect className={drawing.body} x="240" y="62" width="42" height="42" rx="8" />
      <circle className={styles.control} {...tone('P1')} cx="266" cy="66" r="9" />
      <rect className={styles.control} {...tone('T2')} x="232" y="56" width="10" height="20" rx="3" />

      {/* between the face and the wheel, with the P2 dial on it */}
      <rect className={drawing.body} x="136" y="90" width="48" height="40" rx="8" />
      {/* the ring the wheel turns in, with the tabs on the near side and underneath */}
      <circle className={drawing.body} cx="212" cy="112" r="36" />
      <rect className={styles.control} {...tone('T1')} x="177" y="84" width="14" height="9" rx="3" transform="rotate(-40 184 88.5)" />
      <rect className={styles.control} {...tone('T4')} x="177" y="131" width="14" height="9" rx="3" transform="rotate(40 184 135.5)" />
      <rect className={styles.control} {...tone('T5')} x="210" y="144" width="10" height="18" rx="3" />

      {/* the steering wheel */}
      <circle className={drawing.body} cx="238" cy="112" r="40" />
      <circle className={styles.control} {...tone('wheel')} cx="238" cy="112" r="27" />
      <path className={styles.spoke} {...tone('wheel')} d="M238 85v54M214.6 98.5l46.8 27M214.6 125.5l46.8-27" />
      <circle className={drawing.body} cx="238" cy="112" r="7" />

      <circle className={styles.control} {...tone('P2')} cx="160" cy="110" r="9" />

      {/* the face: the screen, and under it the keys, the speaker, the power key and the menu wheel */}
      <path className={drawing.body} d="M42 14H126a14 14 0 0 1 14 14V98C140 128 118 150 84 150S28 128 28 98V28a14 14 0 0 1 14-14Z" />
      <rect className={drawing.sunken} x="38" y="24" width="92" height="44" rx="5" />
      <rect className={styles.key} x="38" y="76" width="26" height="16" rx="3" />
      <rect className={styles.key} x="68" y="76" width="32" height="16" rx="5" />
      <rect className={styles.key} x="104" y="76" width="26" height="16" rx="3" />
      <rect className={styles.key} x="38" y="96" width="26" height="16" rx="3" />
      <circle className={styles.key} cx="84" cy="104" r="6" />
      <rect className={styles.key} x="104" y="96" width="26" height="16" rx="3" />
      <rect className={styles.key} x="44" y="116" width="22" height="14" rx="3" />
      <rect className={styles.key} x="70" y="116" width="28" height="18" rx="4" />
      <path className={styles.key} d="M77 120v10M84 120v10M91 120v10" />
      <rect className={styles.key} x="102" y="116" width="22" height="14" rx="3" />

      {/* SA and SC, at the top of the grip on the wheel's side */}
      <rect className={styles.control} {...tone('SA')} x="172" y="158" width="14" height="9" rx="3" />
      <rect className={styles.control} {...tone('SC')} x="167" y="182" width="14" height="9" rx="3" />

      {dot('P2', 160, 110)}
      {dot('T1', 184, 88.5)}
      {dot('T2', 237, 63)}
      {dot('P1', 266, 66)}
      {dot('wheel', 254, 112)}
      {dot('T4', 184, 135.5)}
      {dot('T5', 215, 156)}
      {dot('SA', 179, 162.5)}
      {dot('SC', 174, 186.5)}
      {dot('SD', 74, 319)}
      {dot('baseSwitchLeft', 201.5, 239)}
      {dot('baseSwitchRight', 233, 251)}
      {dot('joystickUpDown', 219, 236)}
      {dot('joystickLeftRight', 231, 252)}
    </svg>
  )
}

/**
 * The side that faces away from the driver, where the trigger is. The wheel is on the left here.
 * It shows the three controls that cannot be seen from the driver's side.
 */
function OtherSideDrawing({ tone, dot }: DrawingProps) {
  return (
    <svg className={styles.drawing} viewBox="0 0 300 160" aria-hidden="true" focusable="false" data-radio-drawing>
      <rect className={drawing.body} x="96" y="132" width="128" height="22" rx="8" />
      <path className={drawing.body} d="M136 54H184L176 134H130Z" />
      <rect className={drawing.body} x="108" y="12" width="104" height="48" rx="12" />
      <rect className={styles.key} x="154" y="22" width="46" height="24" rx="4" />
      {/* the wheel, seen edge on, and the ring it turns in */}
      <rect className={drawing.body} x="92" y="20" width="16" height="44" rx="4" />
      <rect className={drawing.body} x="68" y="8" width="24" height="62" rx="9" />
      <path className={styles.key} d="M73 24h14M73 39h14M73 54h14" />
      {/* the T3 tab on the ring, the SB button beside it, and the trigger */}
      <rect className={styles.control} {...tone('T3')} x="95" y="60" width="10" height="16" rx="3" />
      <rect className={styles.control} {...tone('SB')} x="114" y="57" width="18" height="10" rx="4" />
      <path className={styles.control} {...tone('trigger')} d="M150 58h13c-4 16 0 30 11 42l-9 7c-13-13-19-31-15-49Z" />

      {dot('T3', 100, 70)}
      {dot('SB', 123, 62)}
      {dot('trigger', 159, 84)}
    </svg>
  )
}

interface RadioPictureProps {
  /** Every control the radio has, with what each does on the model. */
  controls: readonly PictureControl[]
  /** What is fitted on the base of the radio. Until that is known, the blank cover is drawn. */
  baseFitting: BaseFitting | null
}

/**
 * The radio, with a label on every control saying what it does on a model. A screen reader gets
 * it as one image with a short name: the list of controls that goes with it carries the detail.
 */
export function RadioPicture({ controls, baseFitting }: RadioPictureProps) {
  const picture = useRef<HTMLDivElement>(null)
  const [leaders, setLeaders] = useState<readonly Leader[]>([])

  const entries: Entry[] = controls.map((control) => ({
    ...control,
    place: PLACES[control.control],
    used: control.jobs.length > 0,
  }))
  const inView = (view: View) => entries.filter((entry) => entry.place.view === view)
  const used = new Set(entries.filter((entry) => entry.used).map((entry) => entry.control))
  const shown = new Set(entries.map((entry) => entry.control))

  const tone = (control: ControlId) => ({ 'data-used': used.has(control) || undefined })
  // A dot is only drawn for a control this radio has. The base controls depend on what is fitted.
  const dot = (control: ControlId, x: number, y: number) =>
    shown.has(control) && <circle className={styles.dot} {...tone(control)} data-control-dot={control} cx={x} cy={y} r="3.5" />

  // The lines follow the labels. Whatever changes the labels, or the room they have, moves them.
  const words = entries.map((entry) => `${entry.control}:${entry.jobs.join()}`).join('|')
  useLayoutEffect(() => {
    const frame = picture.current
    if (!frame) return
    const draw = () =>
      setLeaders((before) => {
        const now = measure(frame)
        return JSON.stringify(now) === JSON.stringify(before) ? before : now
      })
    draw()
    if (typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(draw)
    watcher.observe(frame)
    return () => watcher.disconnect()
  }, [words, baseFitting])

  const main = inView('main')
  const otherSide = inView('otherSide')
  const split = { '--radio-gap-at': GAP_AT, '--radio-after-gap': DRAWING_WIDTH - GAP_AT } as CSSProperties

  return (
    <div ref={picture} className={styles.picture} role="img" aria-label={text.pictureName} data-radio-picture>
      <div className={styles.view} style={split}>
        {main
          .filter((entry) => entry.place.region === 'aboveLeft' || entry.place.region === 'aboveRight')
          .map((entry) => (
            <Label key={entry.control} entry={entry} />
          ))}
        <Column side="left" entries={main} />
        <MainDrawing tone={tone} dot={dot} fitting={baseFitting ?? 'blankCover'} />
        <Column side="right" entries={main} />
      </div>

      <div className={styles.view} style={split}>
        <p className={styles.caption}>{text.pictureOtherSide}</p>
        <Column side="left" entries={otherSide} />
        <OtherSideDrawing tone={tone} dot={dot} />
        <Column side="right" entries={otherSide} />
      </div>

      <svg className={styles.leaders} aria-hidden="true" focusable="false">
        {leaders.map(({ control, used: strong, x1, y1, x2, y2 }) => (
          <line
            key={control}
            className={styles.leader}
            data-leader-for={control}
            data-used={strong || undefined}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
          />
        ))}
      </svg>
    </div>
  )
}
