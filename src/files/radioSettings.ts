// The radio's own settings file, radio.yml: what the app reads from it so far.
//
// The app does not change this file yet. Near its top are two lines, `checksum` and
// `manuallyEdited`. A later cycle must find out what the radio expects of those two when the app
// changes radio.yml, before anything here writes to it. Until then nothing touches either.

import { valueAt, type Document } from './document.ts'

const CURRENT_MODEL = 'currModel'

/**
 * The number of the model the radio is set to, counted from 0 as the radio writes it. Null when
 * the document is not the radio's settings file.
 */
export function currentModelNumberOf(document: Document): number | null {
  const written = valueAt(document, CURRENT_MODEL) ?? ''
  return /^\d+$/.test(written) ? Number(written) : null
}
