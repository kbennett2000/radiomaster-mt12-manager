import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../App.tsx'
import { controlsFor } from '../domain/catalog.ts'
import { findScenario, type ScenarioId } from '../state/scenarios.ts'
import { strings } from '../strings/en.ts'

const text = strings.addModel.review

/** Opens a page that shows the picture of the radio, the way a reviewer link does. */
function open(id: ScenarioId) {
  const scenario = findScenario(id)!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))
  return { main, picture: main.getByRole('img', { name: text.pictureName }), baseFitting: scenario.state.radio.baseFitting }
}

/** The words on each label of the picture, by control. */
const labelsOf = (picture: HTMLElement): Map<string, string> =>
  new Map(
    [...picture.querySelectorAll<HTMLElement>('[data-control-label]')].map((label) => [
      label.dataset.controlLabel ?? '',
      label.textContent ?? '',
    ]),
  )

test('The picture of the radio labels every control the radio has, and an unused one says "Not used"', () => {
  // Micro B only steers and drives, so everything but the wheel and the trigger is unused.
  const { picture, baseFitting } = open('picture-micro-b')
  const labels = labelsOf(picture)
  const controls = controlsFor(baseFitting).map((control) => control.id)

  expect(controls).toHaveLength(13)
  expect([...labels.keys()].toSorted()).toEqual(controls.toSorted())
  expect(labels.get('wheel')).toBe(strings.features.steering)
  expect(labels.get('trigger')).toBe(strings.features.throttle)
  for (const control of controls.filter((id) => id !== 'wheel' && id !== 'trigger')) {
    expect(labels.get(control)).toBe(`${strings.controlMarks[control]}${text.pictureLabelJoin}${text.notUsed}`)
  }

  // Each label has a dot on its control for its line to end on.
  for (const control of controls) expect(picture.querySelector(`[data-control-dot="${control}"]`)).not.toBeNull()
})

test('The picture and the list give the same job for each control', () => {
  // A radio with two switches on its base, one of them in use.
  const { main, picture, baseFitting } = open('picture-two-switches')
  const labels = labelsOf(picture)
  const list = within(main.getByRole('heading', { name: text.controlsTitle }).parentElement!)
  const controls = controlsFor(baseFitting).map((control) => control.id)
  expect(controls).toHaveLength(15)

  for (const control of controls) {
    // What the list says this control does, and what the picture's label says after the control's name.
    const listed = list.getByText(strings.controls[control]).nextElementSibling?.textContent ?? ''
    const mark = strings.controlMarks[control]
    const pictured = mark ? labels.get(control)!.slice(`${mark}${text.pictureLabelJoin}`.length) : labels.get(control)!

    if (listed === text.notUsed) expect(pictured).toBe(text.notUsed)
    // The list goes on to say how the control works it. It starts with the same short name.
    else expect(listed.startsWith(`${pictured}.`)).toBe(true)
  }
  expect(labels.get('SA')).toBe('SA · 2-speed transmission')
  expect(labels.get('baseSwitchLeft')).toBe('Left switch · Lights')
  expect(labels.get('baseSwitchRight')).toBe('Right switch · Not used')
})
