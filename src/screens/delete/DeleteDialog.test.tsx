import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

test('Delete names the model and will not delete the current model until another is picked', () => {
  render(<App initialState={findScenario('delete-current-model')!.state} />)
  const dialog = within(screen.getByRole('dialog'))

  expect(dialog.getByRole('heading', { name: strings.deleteModel.title('Mini 8ight') })).toBeTruthy()
  expect(dialog.getByRole('button', { name: strings.deleteModel.keep })).toBeTruthy()
  // It says what will happen to the rest of the list before the person confirms.
  expect(dialog.getByText(strings.deleteModel.lastInList)).toBeTruthy()

  fireEvent.click(dialog.getByRole('button', { name: strings.deleteModel.confirm }))

  expect(dialog.getByText(strings.deleteModel.switchMissing)).toBeTruthy()
  // Every row has one Move action, so counting them counts the models still in the list.
  const moveActions = within(screen.getByRole('main')).getAllByRole('button', {
    name: new RegExp(`^${strings.models.move} `),
  })
  expect(moveActions).toHaveLength(20)
})
