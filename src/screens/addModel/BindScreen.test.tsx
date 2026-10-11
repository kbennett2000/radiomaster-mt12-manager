import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { MT12 } from '../../domain/catalog.ts'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.addModel.bind

test('The Bind page shows four steps that name the model, which is already in the list', () => {
  const scenario = findScenario('wizard-bind')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 2, name: text.title })).toBeTruthy()
  for (const step of text.steps('Bouncer')) expect(main.getByText(step)).toBeTruthy()
  expect(main.getByText(text.added('Bouncer', 21))).toBeTruthy()

  // The model is already on the radio: the header counts it.
  expect(screen.getByText(strings.header.sample(21, MT12.maxModels))).toBeTruthy()

  expect(main.getByRole('link', { name: text.backToModels })).toBeTruthy()
  expect(main.getByRole('link', { name: text.finishAndUnplug })).toBeTruthy()
})
