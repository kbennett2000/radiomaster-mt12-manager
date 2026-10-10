import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { MT12 } from '../../domain/catalog.ts'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

test('Your models shows a card for each of the 20 sample models and marks the current one', () => {
  render(<App initialState={findScenario('models-20')!.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 1, name: strings.models.title })).toBeTruthy()
  expect(main.getAllByRole('article')).toHaveLength(20)
  expect(main.getAllByText(strings.models.currentBadge)).toHaveLength(1)
  expect(main.getByRole('link', { name: strings.models.addModel })).toBeTruthy()
  expect(screen.getByText(strings.header.connected(20, MT12.maxModels))).toBeTruthy()
})
