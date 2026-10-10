import { MT12 } from '../domain/catalog.ts'
import type { Model } from '../domain/model.ts'
import { SAMPLE_MODELS, spareModel } from './sampleModels.ts'

/** The 20 sample models plus a plain spare in every other position, for the "60 of 60" state. */
export const FULL_RADIO_MODELS: readonly Model[] = [
  ...SAMPLE_MODELS,
  ...Array.from({ length: MT12.maxModels - SAMPLE_MODELS.length }, (_, index) =>
    spareModel(SAMPLE_MODELS.length + index + 1),
  ),
]
