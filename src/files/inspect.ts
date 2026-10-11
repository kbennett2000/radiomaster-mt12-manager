// What the app makes of one of the radio's files, as a few words for each. This is behind the
// developer command `npm run inspect -- <folder>`. It is a tool for checking the reader against
// real files, so its own words are here and not in the strings file. No page shows them.

import { receiverTypeForNumbers } from '../domain/catalog.ts'
import { strings } from '../strings/en.ts'
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
