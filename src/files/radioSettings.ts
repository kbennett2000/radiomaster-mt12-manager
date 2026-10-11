// The radio's own settings file, radio.yml: what the app reads from it, and the one thing it changes.
//
// The app changes one value in this file: `currModel`, the number of the model the radio is set
// to. Everything else is carried through untouched. See document.ts.
//
// The first line of the file is `checksum: ` and a decimal number. The number is a check over
// every byte after that first line, and the radio compares it when it reads the file. So whenever
// the app changes the file it writes the new number on the first line. The second line,
// `manuallyEdited`, is left alone.

import { bytesFromDocument, documentFromBytes, valueAt, withValueAt, type Document } from './document.ts'

const CURRENT_MODEL = 'currModel'
const CHECKSUM = 'checksum'
const LINE_FEED = 0x0a

/**
 * The number of the model the radio is set to, counted from 0 as the radio writes it. Null when
 * the document is not the radio's settings file.
 */
export function currentModelNumberOf(document: Document): number | null {
  const written = valueAt(document, CURRENT_MODEL) ?? ''
  return /^\d+$/.test(written) ? Number(written) : null
}

/**
 * The radio's 16-bit check over a run of bytes: a cyclic redundancy check with the polynomial
 * 0x1021, starting from 0xFFFF, taking each byte's bits from the top down, with nothing done to
 * the result at the end. Over the nine characters "123456789" it gives 10673.
 */
export function crc16(bytes: Uint8Array): number {
  let check = 0xffff
  for (const byte of bytes) {
    check ^= byte << 8
    for (let bit = 0; bit < 8; bit += 1) {
      // Shift one bit out of the top. When that bit was set, fold the polynomial in.
      check = check & 0x8000 ? ((check << 1) ^ 0x1021) & 0xffff : (check << 1) & 0xffff
    }
  }
  return check
}

/** The checksum a settings file carries on its first line, and the one its bytes call for. */
export interface Checksum {
  written: number
  expected: number
  /** True when the two are the same, which is what the radio looks for. */
  right: boolean
}

/** Everything after the first line and its line ending, which is what the checksum covers. */
const afterFirstLine = (bytes: Uint8Array): Uint8Array => bytes.subarray(bytes.indexOf(LINE_FEED) + 1)

/**
 * Reads the checksum of a settings file. Null when the first line of the document is not a
 * checksum, which means it is not a file the app knows how to check.
 */
export function checksumOf(document: Document): Checksum | null {
  const first = document.entries[0]
  if (first?.key !== CHECKSUM || first.line !== 1 || first.kind !== 'value' || first.quoted) return null
  if (!/^\d+$/.test(first.text)) return null
  const written = Number(first.text)
  const expected = crc16(afterFirstLine(bytesFromDocument(document)))
  return { written, expected, right: written === expected }
}

export type SettingsResult = { ok: true; bytes: Uint8Array } | { ok: false }

/**
 * The bytes of a settings file with the radio set to another model, counted from 0. Two lines
 * change: the one that names the model, and the checksum on the first line, which is worked out
 * afresh from the new bytes. Refused when the file cannot be read, or is not a settings file with
 * a checksum on its first line.
 */
export function withCurrentModelNumber(bytes: Uint8Array, number: number): SettingsResult {
  const read = documentFromBytes(bytes)
  if (!read.ok || currentModelNumberOf(read.document) === null || checksumOf(read.document) === null) return { ok: false }
  const set = withValueAt(read.document, CURRENT_MODEL, String(number))
  if (!set.ok) return { ok: false }
  const check = crc16(afterFirstLine(bytesFromDocument(set.document)))
  const checked = withValueAt(set.document, CHECKSUM, String(check))
  return checked.ok ? { ok: true, bytes: bytesFromDocument(checked.document) } : { ok: false }
}
