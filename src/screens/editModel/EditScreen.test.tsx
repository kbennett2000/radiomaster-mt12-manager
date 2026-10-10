import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.editModel

test('The Edit page sums up a model, offers each part to change, and shows what it leaves alone', () => {
  const scenario = findScenario('edit-trx4-22')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 1, name: text.title('TRX-4 2-2') })).toBeTruthy()
  expect(main.getByText(text.position(6))).toBeTruthy()
  // The position is changed in the list, so that row has words in place of "Change".
  expect(main.getByText(text.positionNote)).toBeTruthy()

  // Name, receiver, steering, throttle, six extras and radio feedback each have a "Change".
  expect(main.getAllByRole('link', { name: /^Change / })).toHaveLength(11)
  expect(main.getByRole('link', { name: text.addOrRemoveExtras })).toBeTruthy()

  // What was set up on the radio is named, with its control, and left alone.
  const leftAlone = within(main.getByRole('heading', { level: 2, name: text.leftAlone.title }).parentElement!)
  expect(leftAlone.getByText(text.leftAlone.help)).toBeTruthy()
  expect(leftAlone.getByText('One-button preset: Locked + low gear')).toBeTruthy()
  expect(leftAlone.getByText(strings.controls.SD)).toBeTruthy()
  expect(leftAlone.getByText('Feedback for the whole model')).toBeTruthy()

  expect(main.getByRole('heading', { level: 2, name: strings.addModel.review.controlsTitle })).toBeTruthy()
  expect(main.getByRole('heading', { level: 2, name: strings.addModel.review.portsTitle })).toBeTruthy()

  // One way on, and nothing to save here: saving happens on the page for each part.
  expect(main.getByRole('link', { name: text.backToModels })).toBeTruthy()
  expect(main.queryByRole('button', { name: text.save })).toBeNull()
})
