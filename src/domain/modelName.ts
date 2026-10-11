import { MT12 } from './catalog.ts'

export type ModelNameProblem = 'empty' | 'notPlain' | 'tooLong' | 'alreadyUsed'

/**
 * What a name on a real card may be made of: plain letters, numbers, spaces and the everyday marks
 * on a keyboard, with no double quote and no backslash. That is exactly what the radio's file
 * layout can hold between its double quotes: see WRITABLE_IN_QUOTES in src/files/document.ts.
 */
const PLAIN = /^[ !#-[\]-~]*$/

export interface NameRules {
  /** True for a name that is going onto a real card, which can only hold plain characters. */
  plainOnly?: boolean
  maxLength?: number
}

/** Checks a name for a new model. Returns the first problem found, or null when the name is fine. */
export function checkModelName(
  name: string,
  namesInUse: readonly string[],
  { plainOnly = false, maxLength = MT12.maxModelNameLength }: NameRules = {},
): ModelNameProblem | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'empty'
  if (plainOnly && !PLAIN.test(trimmed)) return 'notPlain'
  if (trimmed.length > maxLength) return 'tooLong'
  const wanted = trimmed.toLowerCase()
  if (namesInUse.some((used) => used.trim().toLowerCase() === wanted)) return 'alreadyUsed'
  return null
}
