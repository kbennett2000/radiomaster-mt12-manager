import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.addModel.feedback

test('Step 5 asks for the model light colour and has one row per extra that switches, all starting off', () => {
  const scenario = findScenario('wizard-feedback-rows')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 2, name: text.question })).toBeTruthy()

  // Seven colours and "Don't change", which is where it starts.
  const modelColour = within(main.getByRole('radiogroup', { name: text.modelColour }))
  expect(modelColour.getAllByRole('radio')).toHaveLength(8)
  expect((modelColour.getByRole('radio', { name: text.dontChange }) as HTMLInputElement).checked).toBe(true)

  // Five of the six extras picked switch. Gyro gain is a dial, so it has no row.
  expect(main.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual([
    strings.features.twoSpeedTransmission,
    strings.features.frontDiffLock,
    strings.features.rearDiffLock,
    strings.features.lights,
    strings.features.cruiseControl,
  ])

  // An extra that is only on or off has one light colour. The gearbox is on the SA switch, so it
  // has one for each gear and one for neutral. They all start on None.
  const colourFor = (state: keyof typeof text.colourFor, extra: string) =>
    main.queryByRole('combobox', { name: text.settingFor(text.colourFor[state], extra) }) as HTMLSelectElement | null
  expect(colourFor('on', strings.features.frontDiffLock)?.value).toBe('none')
  expect(colourFor('on', strings.features.twoSpeedTransmission)).toBeNull()
  for (const state of ['low', 'high', 'neutral'] as const) {
    expect(colourFor(state, strings.features.twoSpeedTransmission)?.value).toBe('none')
  }
  expect(main.getAllByText(text.optional)).toHaveLength(1)

  const sound = within(main.getByRole('radiogroup', { name: text.settingFor(text.sound, strings.features.frontDiffLock) }))
  expect((sound.getByRole('radio', { name: text.sounds.off }) as HTMLInputElement).checked).toBe(true)

  // Under Voice, it shows the words it would say.
  fireEvent.click(sound.getByRole('radio', { name: text.sounds.voice }))
  expect(main.getByText(text.says(text.voice.frontDiffLock))).toBeTruthy()
})
