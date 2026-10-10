import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { MT12 } from '../../domain/catalog.ts'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

test('Your models lists the 20 sample models in position order and marks the current one', () => {
  render(<App initialState={findScenario('models-20')!.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 1, name: strings.models.title })).toBeTruthy()

  const names = main.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  expect(names).toHaveLength(20)
  expect(names[0]).toBe('Wraith')
  expect(names[19]).toBe('Mini 8ight')

  expect(main.getByText(strings.models.currentStrip('Mini 8ight', 20))).toBeTruthy()
  expect(main.getAllByText(strings.models.currentMark)).toHaveLength(1)
  expect(main.getByText(strings.models.emptyAfter(21, MT12.maxModels))).toBeTruthy()
  expect(main.getByRole('link', { name: strings.models.addModel })).toBeTruthy()
  expect(screen.getByText(strings.header.connected(20, MT12.maxModels))).toBeTruthy()
})
