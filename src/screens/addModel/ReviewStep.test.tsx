import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.addModel.review

test('Review sums up the answers, says what each control and port does, and adds the model', () => {
  const scenario = findScenario('wizard-review-crawler')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 2, name: text.title })).toBeTruthy()
  expect(main.getByText('Bouncer')).toBeTruthy()
  expect(main.getByText(strings.receiverTypes['dumborc-x'])).toBeTruthy()
  expect(main.getByText(text.feel.gentle)).toBeTruthy()

  // What each control does: a used one says how it works, and an unused one says so.
  const controls = within(main.getByRole('heading', { level: 3, name: text.controlsTitle }).parentElement!)
  expect(
    controls.getByText(text.job(strings.features.twoSpeedTransmission, strings.addModel.how.twoSpeed.switch3(false))),
  ).toBeTruthy()
  expect(controls.getAllByText(text.notUsed)).toHaveLength(2)

  // What to plug into the receiver: every port from 1 to 8.
  const ports = within(main.getByRole('heading', { level: 3, name: text.portsTitle }).parentElement!)
  expect(ports.getAllByRole('term')).toHaveLength(8)
  expect(ports.getByText('Winch')).toBeTruthy()

  fireEvent.click(main.getByRole('button', { name: text.confirm }))

  expect(main.getByRole('heading', { level: 1, name: strings.models.title })).toBeTruthy()
  expect(main.getByText(strings.notice.added('Bouncer', 21))).toBeTruthy()
  expect(main.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toContain('Bouncer')
})
