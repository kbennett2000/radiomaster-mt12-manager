import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.addModel

test('Step 1 asks for a name and a kind of vehicle, and says what is missing when Next is clicked', () => {
  const scenario = findScenario('wizard-name-empty')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 1, name: text.title })).toBeTruthy()
  expect(main.getByText(text.goesIn(21))).toBeTruthy()
  expect(within(main.getByRole('navigation', { name: text.stepsLabel })).getAllByRole('listitem')).toHaveLength(7)
  expect(main.getByLabelText(text.name.question)).toBeTruthy()
  expect(main.getAllByRole('radio')).toHaveLength(4)

  fireEvent.click(main.getByRole('button', { name: text.next }))

  expect(main.getByText(text.name.empty)).toBeTruthy()
  expect(main.getByText(text.name.kindMissing)).toBeTruthy()
})
