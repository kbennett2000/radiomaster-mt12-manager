import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { RECEIVER_TYPES } from '../../domain/catalog.ts'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.addModel.receiver

test('Step 2 lists every receiver and narrows the list as the person types', () => {
  const scenario = findScenario('wizard-receiver')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 2, name: text.question })).toBeTruthy()
  expect(main.getAllByRole('radio')).toHaveLength(RECEIVER_TYPES.length)

  // Capitals, spaces and dashes are ignored.
  fireEvent.change(main.getByLabelText(text.searchLabel), { target: { value: 'SCX 24' } })
  expect(main.getAllByRole('radio')).toHaveLength(1)
  expect(main.getByText(strings.receiverTypes['axial-scx24'])).toBeTruthy()

  fireEvent.change(main.getByLabelText(text.searchLabel), { target: { value: 'tamiya' } })
  expect(main.queryAllByRole('radio')).toHaveLength(0)
  expect(main.getByText(text.nothingMatches('tamiya'))).toBeTruthy()
})
