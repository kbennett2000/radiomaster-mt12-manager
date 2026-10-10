// Simple line drawings for the Connect steps and the "what is on the base" choices.
// They are my own schematic sketches, not copies of anyone's artwork.
// Each one is decoration next to words that say the same thing, so they are hidden from screen readers.

import type { ReactNode } from 'react'
import type { BaseFitting } from '../domain/radio.ts'
import styles from './drawings.module.css'

function Drawing({ viewBox, children }: { viewBox: string; children: ReactNode }) {
  return (
    <svg className={styles.drawing} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

/** Step 1: the cable goes into the port under the cover, next to the SD card slot. */
export function PlugInCableDrawing() {
  return (
    <Drawing viewBox="0 0 240 150">
      {/* the side of the radio */}
      <rect className={styles.body} x="14" y="14" width="126" height="122" rx="16" />
      {/* the cover, swung open below the bay */}
      <path className={styles.line} d="M46 100l-8 22h74l-8-22" />
      {/* the bay under the cover */}
      <rect className={styles.sunken} x="40" y="32" width="70" height="68" rx="8" />
      {/* the USB port */}
      <rect className={styles.accentSoft} x="57" y="46" width="36" height="16" rx="8" />
      {/* the SD card slot, with a card in it */}
      <rect className={styles.line} x="54" y="76" width="42" height="8" rx="2" />
      <path className={styles.thin} d="M60 80h30" />
      {/* the way in */}
      <path className={styles.accentDashed} d="M150 54h-46" />
      <path className={styles.accentLine} d="M110 48l-7 6 7 6" />
      {/* the plug and its cable */}
      <rect className={styles.body} x="154" y="48" width="20" height="12" rx="3" />
      <rect className={styles.body} x="174" y="42" width="34" height="24" rx="5" />
      <path className={styles.line} d="M208 54c18 0 24 14 18 34s-22 30-4 48" />
    </Drawing>
  )
}

/** Step 2: the radio's screen, with the right menu line picked out. */
export function RadioScreenDrawing({ choice }: { choice: string }) {
  return (
    <Drawing viewBox="0 0 240 150">
      <rect className={styles.body} x="26" y="14" width="188" height="122" rx="14" />
      <rect className={styles.sunken} x="40" y="28" width="160" height="94" rx="6" />
      <path className={styles.thin} d="M56 47h78" />
      <rect className={styles.accentFill} x="50" y="62" width="140" height="26" rx="5" />
      <text className={styles.onAccentText} x="120" y="79.5" textAnchor="middle">
        {choice}
      </text>
      <path className={styles.thin} d="M56 103h62" />
    </Drawing>
  )
}

/** Step 3: the browser's list of drives, with the radio's drive picked. */
export function PickDriveDrawing() {
  return (
    <Drawing viewBox="0 0 240 150">
      <rect className={styles.body} x="22" y="14" width="196" height="122" rx="12" />
      <path className={styles.line} d="M22 38h196" />
      <circle className={styles.dot} cx="38" cy="26" r="3" />
      <circle className={styles.dot} cx="50" cy="26" r="3" />
      <circle className={styles.dot} cx="62" cy="26" r="3" />
      {/* a drive that is not the radio */}
      <rect className={styles.line} x="42" y="55" width="20" height="13" rx="3" />
      <path className={styles.thin} d="M74 61.5h70" />
      {/* the radio's drive, picked */}
      <rect className={styles.accentSoft} x="34" y="80" width="172" height="34" rx="8" />
      <rect className={styles.accentLine} x="42" y="90.5" width="20" height="13" rx="3" />
      <path className={styles.accentLine} d="M74 97h56" />
      {/* the pointer */}
      <path className={styles.pointer} d="M168 92v24l6.5-5.5 4.6 10 4.6-2.1-4.6-9.9 8.4-.6z" />
    </Drawing>
  )
}

const basePlate = (
  <>
    <rect className={styles.body} x="20" y="18" width="160" height="84" rx="28" />
    <rect className={styles.sunken} x="58" y="34" width="84" height="52" rx="10" />
  </>
)

/** The base of the radio seen from below, with one of the three things that can be fitted to it. */
export function BaseFittingDrawing({ fitting }: { fitting: BaseFitting }) {
  return (
    <Drawing viewBox="0 0 200 120">
      {basePlate}
      {fitting === 'blankCover' && (
        <>
          <circle className={styles.dot} cx="70" cy="46" r="2.5" />
          <circle className={styles.dot} cx="130" cy="46" r="2.5" />
          <circle className={styles.dot} cx="70" cy="74" r="2.5" />
          <circle className={styles.dot} cx="130" cy="74" r="2.5" />
        </>
      )}
      {fitting === 'twoSwitches' && (
        <>
          <circle className={styles.accentSoft} cx="83" cy="66" r="10" />
          <path className={styles.lever} d="M83 66l-6-18" />
          <circle className={styles.accentSoft} cx="117" cy="66" r="10" />
          <path className={styles.lever} d="M117 66l6-18" />
        </>
      )}
      {fitting === 'joystick' && (
        <>
          <circle className={styles.line} cx="100" cy="60" r="19" />
          <circle className={styles.accentSoft} cx="100" cy="60" r="10" />
          <circle className={styles.accentDot} cx="100" cy="60" r="3" />
        </>
      )}
    </Drawing>
  )
}
