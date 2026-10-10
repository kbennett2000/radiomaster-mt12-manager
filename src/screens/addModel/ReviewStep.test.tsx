import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.addModel.review

test('Review sums up the answers, and "Add to my radio" puts the model in the list', () => {
  const scenario = findScenario('wizard-review')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 2, name: text.title })).toBeTruthy()
  expect(main.getByText('Bouncer')).toBeTruthy()
  expect(main.getByText(strings.receiverTypes['dumborc-x'])).toBeTruthy()
  expect(main.getByText(text.feel.gentle)).toBeTruthy()
  expect(main.getByText(text.comingNext)).toBeTruthy()

  fireEvent.click(main.getByRole('button', { name: text.confirm }))

  expect(main.getByRole('heading', { level: 1, name: strings.models.title })).toBeTruthy()
  expect(main.getByText(strings.notice.added('Bouncer', 21))).toBeTruthy()
  expect(main.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toContain('Bouncer')
})
