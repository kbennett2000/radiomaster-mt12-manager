import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.addModel.steeringThrottle

test('Step 3 has steering and throttle settings, and starts a crawler on Gentle', () => {
  const scenario = findScenario('wizard-steering-crawler')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 2, name: text.steering })).toBeTruthy()
  expect(main.getByRole('heading', { level: 2, name: text.throttle })).toBeTruthy()

  const feel = within(main.getByRole('radiogroup', { name: text.feel }))
  expect((feel.getByRole('radio', { name: text.feels.gentle }) as HTMLInputElement).checked).toBe(true)

  expect((main.getByRole('slider', { name: text.travel('crawler') }) as HTMLInputElement).value).toBe('100')
  expect((main.getByRole('slider', { name: text.topSpeed }) as HTMLInputElement).value).toBe('100')
})
