import { MT12 } from './catalog.ts'

export type ModelNameProblem = 'empty' | 'tooLong' | 'alreadyUsed'

/** Checks a name for a new model. Returns the first problem found, or null when the name is fine. */
export function checkModelName(
  name: string,
  namesInUse: readonly string[],
  maxLength: number = MT12.maxModelNameLength,
): ModelNameProblem | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'empty'
  if (trimmed.length > maxLength) return 'tooLong'
  const wanted = trimmed.toLowerCase()
  if (namesInUse.some((used) => used.trim().toLowerCase() === wanted)) return 'alreadyUsed'
  return null
}
