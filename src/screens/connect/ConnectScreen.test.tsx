import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { initialState } from '../../state/appState.ts'
import { strings } from '../../strings/en.ts'

test('Connect shows three steps, the Connect button and the quiet link', () => {
  render(<App initialState={initialState(true)} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 1, name: strings.connect.title })).toBeTruthy()
  expect(main.getAllByRole('listitem')).toHaveLength(3)
  expect(main.getByRole('button', { name: strings.connect.connectButton })).toBeTruthy()
  expect(main.getByRole('link', { name: strings.connect.openFilesLink })).toBeTruthy()
})
