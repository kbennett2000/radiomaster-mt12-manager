import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { findScenario } from '../../state/scenarios.ts'
import { strings } from '../../strings/en.ts'

const text = strings.addModel.extras

test('Step 4 lists the extras, opens the questions for a picked one, and shows a taken control as taken', () => {
  const scenario = findScenario('wizard-extras-crawler')!
  window.location.hash = scenario.path
  render(<App initialState={scenario.state} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 2, name: text.question })).toBeTruthy()
  expect(main.getAllByRole('checkbox')).toHaveLength(10)
  // A crawler gets the label on the first five, and nothing is picked for it.
  expect(main.getAllByText(text.commonOnCrawlers)).toHaveLength(5)
  expect(main.queryAllByRole('radio')).toHaveLength(0)

  fireEvent.click(main.getByRole('checkbox', { name: /^Lights/ }))
  expect(main.getByRole('group', { name: text.controlQuestion })).toBeTruthy()
  // It starts on the lowest free receiver port.
  expect((main.getByRole('radio', { name: text.port(3) }) as HTMLInputElement).checked).toBe(true)

  fireEvent.click(main.getByRole('radio', { name: /SB button/ }))
  expect(main.getByText(strings.addModel.how.onOff.pushButton)).toBeTruthy()

  // Picking another extra folds Lights down, and its control and port are now taken.
  fireEvent.click(main.getByRole('checkbox', { name: /^Front diff lock/ }))
  expect((main.getByRole('radio', { name: /SB button/ }) as HTMLInputElement).disabled).toBe(true)
  expect(main.getAllByText(new RegExp(text.usedBy(strings.features.lights)))).toHaveLength(2)
  expect((main.getByRole('radio', { name: text.port(4) }) as HTMLInputElement).checked).toBe(true)
})
