// What the app makes of one of the radio's files, as a few words for each. This is behind the
// developer command `npm run inspect -- <folder>`. It is a tool for checking the reader against
// real files, so its own words are here and not in the strings file. No page shows them.

import { receiverTypeForNumbers } from '../domain/catalog.ts'
import { strings } from '../strings/en.ts'
import { RADIO_SETTINGS_PATH, readCard, type Card, type CardModel, type DeletedModel } from './card.ts'
import { bytesFromDocument, documentFromBytes } from './document.ts'
import { modelNameOf, receiverNumbersOf } from './model.ts'
import { currentModelNumberOf } from './radioSettings.ts'

/** What the tool says about one file. */
export interface Inspection {
  /** The file name, what kind of file it is, the model's name, its receiver type, and the result. */
  fields: readonly [name: string, kind: string, model: string, receiver: string, result: string]
  /** True when writing what was read gives the same bytes. */
  exact: boolean
}

const NOT_THERE = '-'

/** The number of the first line on which two files differ, counted from 1, or null when they are the same. */
export function firstLineThatDiffers(first: Uint8Array, second: Uint8Array): number | null {
  let line = 1
  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    if (first[index] !== second[index]) return line
    if (first[index] === 0x0a) line += 1
  }
  return null
}

/** The receiver type as the app names it, or the two numbers when the app's list does not have it. */
function receiverWords(numbers: readonly [number, number] | null): string {
  if (!numbers) return 'no receiver numbers'
  const receiverTypeId = receiverTypeForNumbers(...numbers)
  return receiverTypeId ? strings.receiverTypes[receiverTypeId] : `not in the app's list (${numbers.join(',')})`
}

/** Reads one file and writes it straight back, and says what came of it. */
export function inspectFile(fileName: string, bytes: Uint8Array): Inspection {
  const read = documentFromBytes(bytes)
  if (!read.ok) {
    const why = strings.files.refused[read.reason](read.line)
    return { fields: [fileName, 'not recognised', NOT_THERE, NOT_THERE, `refused: ${why}`], exact: false }
  }
  const { document } = read
  const differs = firstLineThatDiffers(bytes, bytesFromDocument(document))
  const result = differs === null ? 'exact' : `differs at line ${differs}`

  // A model's file has the model's name in it. The radio's settings file says which model is current.
  const name = modelNameOf(document)
  let kind = 'not recognised'
  if (name !== null) kind = 'model'
  else if (currentModelNumberOf(document) !== null) kind = 'radio settings'

  return {
    fields: [
      fileName,
      kind,
      name === null ? NOT_THERE : `"${name}"`,
      name === null ? NOT_THERE : receiverWords(receiverNumbersOf(document)),
      result,
    ],
    exact: differs === null,
  }
}

// A whole card: the two folders the app looks at.

/** What the tool says about a card. */
export interface CardInspection {
  lines: readonly string[]
  /** True when every file was read and the settings' checksum is right. */
  clean: boolean
}

const fileName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/**
 * Lines the rows up in columns. A row may stop early: whatever is last in a row is not padded and
 * does not widen its column, so one long message does not push everything else across.
 */
function inColumns(rows: readonly (readonly string[])[], rightAlignFirst = false): string[] {
  const widths: number[] = []
  for (const row of rows) {
    row.slice(0, -1).forEach((cell, column) => (widths[column] = Math.max(widths[column] ?? 0, cell.length)))
  }
  return rows.map((row) =>
    row
      .map((cell, column) => {
        if (column === row.length - 1) return cell
        return column === 0 && rightAlignFirst ? cell.padStart(widths[column]) : cell.padEnd(widths[column])
      })
      .join('  '),
  )
}

/** The name and receiver of a model's file, or the one thing there is to say when it has neither. */
function about(model: CardModel | DeletedModel): string[] {
  if (model.refusal) return [`could not be read: ${strings.files.refused[model.refusal.reason](model.refusal.line)}`]
  if (model.name === null) return ['has no model name in it']
  return [`"${model.name}"`, receiverWords(model.receiverNumbers)]
}

/**
 * Says what the app makes of a card: one line for each position in use, which one the radio is
 * set to, whether the settings' checksum is right, and everything else found in the two folders.
 * `folders` is every folder inside MODELS and RADIO, since a card here is only its files.
 */
export function inspectCard(card: Card, folders: readonly string[]): CardInspection {
  const reading = readCard(card)
  const lines: string[] = []

  lines.push(`MODELS: ${reading.models.length} of 60 places in use`)
  const rows = reading.models.map((model) => {
    const mark = model.position === reading.currentPosition ? ['<- the radio is set to this one'] : []
    return [String(model.position), fileName(model.path), ...about(model), ...mark]
  })
  lines.push(...inColumns(rows, true).map((row) => `  ${row}`))

  if (reading.deleted.length > 0) {
    lines.push(`Deleted models kept in MODELS/DELETED: ${reading.deleted.length}`)
    const kept = reading.deleted.map((model) => [fileName(model.path), ...about(model), `was in position ${model.cameFrom}`])
    lines.push(...inColumns(kept).map((row) => `  ${row}`))
  }

  const settings = reading.refused.find((file) => file.path === RADIO_SETTINGS_PATH)
  if (!card.has(RADIO_SETTINGS_PATH)) {
    lines.push(`${RADIO_SETTINGS_PATH}: not there`)
  } else if (settings) {
    lines.push(`${RADIO_SETTINGS_PATH}: could not be read: ${strings.files.refused[settings.reason](settings.line)}`)
  } else {
    const position = reading.currentPosition
    const there = reading.models.some((model) => model.position === position)
    let set = 'it does not say which of the 60 places the radio is set to'
    if (position !== null) set = `currModel is ${position - 1}, so the radio is set to position ${position}${there ? '' : ', which is empty'}`
    let check = 'It has no checksum on its first line.'
    if (reading.checksum?.right) check = `Its checksum is right (${reading.checksum.written}).`
    else if (reading.checksum) check = `Its checksum is WRONG: the file says ${reading.checksum.written} and its bytes call for ${reading.checksum.expected}.`
    lines.push(`${RADIO_SETTINGS_PATH}: ${set}. ${check}`)
  }

  // Everything else in the two folders, which the app leaves alone.
  for (const folder of ['MODELS', 'RADIO']) {
    const inside = [...reading.others, ...folders.map((path) => `${path}/`)]
      .filter((path) => path.startsWith(`${folder}/`))
      .map((path) => path.slice(folder.length + 1))
      .toSorted()
    lines.push(`Also in ${folder}: ${inside.length > 0 ? inside.join(', ') : 'nothing'}`)
  }

  return { lines, clean: reading.refused.length === 0 && reading.checksum?.right === true }
}

