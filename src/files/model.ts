// A model's file: the few things the app reads from it and the one thing it changes, so far.
// Everything else in the file is carried through untouched. See document.ts.

import { checkModelName, type ModelNameProblem } from '../domain/modelName.ts'
import { valueAt, withValueAt, type Document } from './document.ts'

const NAME = 'header.name'
// The first of the radio's modules, and the two numbers it uses to pick a receiver type. They
// match `moduleNumbers` in the app's list of receiver types.
const RECEIVER_NUMBERS = 'moduleData.0.subType'

/** The model's name, or null when the document is not a model's file. */
export const modelNameOf = (document: Document): string | null => valueAt(document, NAME)

/** The two numbers that pick the model's receiver type, or null when the file does not have them. */
export function receiverNumbersOf(document: Document): readonly [number, number] | null {
  const pair = /^(\d+),(\d+)$/.exec(valueAt(document, RECEIVER_NUMBERS) ?? '')
  return pair ? [Number(pair[1]), Number(pair[2])] : null
}

/** Why a model could not be given a name. */
export type RenameProblem =
  /** One of the rules every model name follows. */
  | ModelNameProblem
  /** The document has no model name to change. */
  | 'notAModel'
  /** The name has a character the file's layout cannot hold, such as a double quote. */
  | 'cannotBeWritten'

export type RenameResult = { ok: true; document: Document } | { ok: false; problem: RenameProblem }

/**
 * A copy of a model's document with a new name. The name follows the same rules as everywhere
 * else in the app, so one that is empty, too long or already used by another model is refused.
 * Only the line that holds the name changes.
 */
export function withModelName(document: Document, name: string, otherNames: readonly string[] = []): RenameResult {
  if (modelNameOf(document) === null) return { ok: false, problem: 'notAModel' }
  const problem = checkModelName(name, otherNames)
  if (problem) return { ok: false, problem }
  const renamed = withValueAt(document, NAME, name.trim())
  return renamed.ok ? renamed : { ok: false, problem: renamed.problem === 'noSuchValue' ? 'notAModel' : 'cannotBeWritten' }
}
