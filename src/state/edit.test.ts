import { expect, test } from 'vitest'
import { SAMPLE_MODELS } from '../sample/sampleModels.ts'
import { draftFrom, partHasChanges, partIsFine, problemsInEdit } from './edit.ts'

const trx4 = SAMPLE_MODELS.find((model) => model.name === 'TRX-4')!

test('a model may keep its own name, and still may not take the name of another model', () => {
  const draft = draftFrom(trx4)

  // Its own name is not in the way: nothing is wrong, and nothing has changed.
  const kept = problemsInEdit(trx4, draft, SAMPLE_MODELS)
  expect(kept.name).toBeNull()
  expect(partIsFine('name', kept)).toBe(true)
  expect(partHasChanges(trx4, 'name', draft)).toBe(false)

  // Capitals and spaces at the ends do not make it a different name.
  expect(problemsInEdit(trx4, { ...draft, name: ' trx-4 ' }, SAMPLE_MODELS).name).toBeNull()

  const taken = problemsInEdit(trx4, { ...draft, name: 'Summit' }, SAMPLE_MODELS)
  expect(taken.name).toBe('alreadyUsed')
  expect(partIsFine('name', taken)).toBe(false)

  expect(problemsInEdit(trx4, { ...draft, name: '' }, SAMPLE_MODELS).name).toBe('empty')
  expect(problemsInEdit(trx4, { ...draft, name: 'TRX-4 Sport' }, SAMPLE_MODELS).name).toBe('tooLong')
})
