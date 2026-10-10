import type { ModelId } from '../../domain/model.ts'

/** The id of a model's row in the page, so other parts of the screen can scroll to it. */
export const rowId = (modelId: ModelId): string => `model-row-${modelId}`

/**
 * Brings a model's row into the middle of the window. It slides there, unless the person has
 * asked their computer for less motion. Returns the row, or null if the model has no row.
 */
export function scrollToRow(modelId: ModelId): HTMLElement | null {
  const row = document.getElementById(rowId(modelId))
  if (!row) return null
  const lessMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
  row.scrollIntoView?.({ block: 'center', behavior: lessMotion ? 'auto' : 'smooth' })
  return row
}
