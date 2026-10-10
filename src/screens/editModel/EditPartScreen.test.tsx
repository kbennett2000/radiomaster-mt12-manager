import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario, type ScenarioId } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.editModel

/** Opens the page for one part of a model, the way a reviewer link does. */
function open(id: ScenarioId) {
  const scenario = findScenario(id)!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  return within(screen.getByRole('main'))
}

const save = (main: ReturnType<typeof open>) => fireEvent.click(main.getByRole('button', { name: text.save }))

test('The Name page asks for the name alone, and a model may keep its own name', () => {
  const main = open('edit-name')

  expect(main.getByRole('heading', { level: 1, name: text.title('TRX-4') })).toBeTruthy()
  expect((main.getByLabelText(strings.addModel.name.question) as HTMLInputElement).value).toBe('TRX-4')
  // No list of steps, and no question about the kind of vehicle.
  expect(main.queryByRole('navigation')).toBeNull()
  expect(main.queryAllByRole('radio')).toHaveLength(0)
  expect(main.getByRole('link', { name: text.cancel })).toBeTruthy()

  // Saving with nothing changed goes back to the model, with no notice.
  save(main)
  expect(main.getByRole('link', { name: text.backToModels })).toBeTruthy()
  expect(main.queryByText(strings.notice.savedTitle)).toBeNull()
})

test('The Receiver page says a different receiver must be bound again, and the notice shows how', () => {
  const main = open('edit-receiver')

  expect(main.getByText(strings.addModel.receiver.picked(strings.receiverTypes['spektrum-dsmr']))).toBeTruthy()
  expect(main.queryByText(text.bindAgainWarning)).toBeNull()

  fireEvent.click(main.getByRole('radio', { name: new RegExp(strings.receiverTypes['spektrum-dsm2']) }))
  expect(main.getByText(text.bindAgainWarning)).toBeTruthy()

  save(main)
  expect(main.getByText(strings.notice.savedTitle)).toBeTruthy()
  expect(main.getByText(new RegExp(text.saved.bindAgain))).toBeTruthy()
  expect(main.getByRole('link', { name: text.saved.showMeHow })).toBeTruthy()
  expect(main.getByRole('button', { name: strings.notice.undo })).toBeTruthy()
})

test('The Steering and throttle page offers a throttle feel made on the radio as "Custom", and warns before replacing it', () => {
  const main = open('edit-steering-custom')
  const feel = within(main.getByRole('radiogroup', { name: strings.addModel.steeringThrottle.feel }))

  expect(feel.getAllByRole('radio')).toHaveLength(3)
  expect((feel.getByRole('radio', { name: text.customFeel }) as HTMLInputElement).checked).toBe(true)
  expect(main.getByText(text.customFeelHelp)).toBeTruthy()
  // The kind of vehicle is not known, so the words do not mention wheels.
  expect(main.queryByText(/wheels/)).toBeNull()

  fireEvent.click(feel.getByRole('radio', { name: strings.addModel.steeringThrottle.feels.standard }))
  expect(main.getByText(text.customFeelReplaced)).toBeTruthy()
  expect(main.queryByText(text.customFeelHelp)).toBeNull()
})

test('The Extras page lists all ten, folds the ones the model has, and shows a control a preset uses as taken', () => {
  const main = open('edit-extras-held')

  // Nine extras by name and the model's own "Trail Tracer mode". Seven are ticked: its six, and Lights, just added.
  expect(main.getAllByRole('checkbox')).toHaveLength(10)
  expect(main.getAllByRole('checkbox', { checked: true })).toHaveLength(7)
  expect(main.queryByText(strings.addModel.extras.commonOnCrawlers)).toBeNull()

  // Lights is open. The SD button is used by a preset made on the radio, so it cannot be picked.
  const preset = 'One-button preset: Locked + low gear'
  expect((main.getByRole('radio', { name: /SD button/ }) as HTMLInputElement).disabled).toBe(true)
  expect(main.getByText(new RegExp(strings.addModel.extras.usedBy(preset).replace('+', '\\+')))).toBeTruthy()
  expect((main.getByRole('radio', { name: /T1 buttons/ }) as HTMLInputElement).disabled).toBe(false)
  expect(main.getByText(text.leftAlone.alsoOnModel([preset]))).toBeTruthy()
})

test('The Radio feedback page has a row for each extra that switches, and a saved change can be undone', () => {
  const main = open('edit-feedback')

  expect(main.getByText(text.leftAlone.feedbackAlso)).toBeTruthy()
  expect(main.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual([
    strings.features.twoSpeedTransmission,
    strings.features.frontDiffLock,
    strings.features.rearDiffLock,
    strings.features.lights,
    strings.features.cruiseControl,
  ])

  const feedback = strings.addModel.feedback
  const sound = within(main.getByRole('radiogroup', { name: feedback.settingFor(feedback.sound, strings.features.lights) }))
  fireEvent.click(sound.getByRole('radio', { name: feedback.sounds.beep }))
  save(main)

  expect(main.getByText(text.saved.feedback('TRX-4'))).toBeTruthy()
  expect(main.getByText('Lights: beep')).toBeTruthy()

  fireEvent.click(main.getByRole('button', { name: strings.notice.undo }))
  expect(main.getByText(text.saved.undone('TRX-4'))).toBeTruthy()
  expect(main.queryByText('Lights: beep')).toBeNull()
})
