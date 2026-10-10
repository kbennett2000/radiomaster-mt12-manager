import type { ModelId } from '../../domain/model.ts'

/** The id of a model's row in the page, so other parts of the screen can scroll to it. */
export const rowId = (modelId: ModelId): string => `model-row-${modelId}`
