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

  fireEvent.click(dialog.getByRole('button', { name: strings.deleteModel.confirm }))

  expect(dialog.getByText(strings.deleteModel.switchMissing)).toBeTruthy()
  expect(within(screen.getByRole('main')).getAllByRole('article')).toHaveLength(20)
})
