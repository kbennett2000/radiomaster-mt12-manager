/// <reference types="node" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../App.tsx'
import { MT12 } from '../../domain/catalog.ts'
import { modelPath, RADIO_SETTINGS_PATH, readCard, type Card } from '../../files/card.ts'
import { bytesFromText } from '../../files/document.ts'
import { withCurrentModelNumber } from '../../files/radioSettings.ts'
import { initialState, reducer, type AppState } from '../../state/appState.ts'
import { strings } from '../../strings/en.ts'
import { cardFromFolder } from '../../test/cardFromFolder.ts'

// The made-up card: Pebble, Gravel Cat and Mudskipper in positions 1 to 3, position 4 empty, then
// Tin Snail, whose receiver type the app does not know, and Bog Hopper. The radio is set to Tin Snail.
const testdata = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'files', 'testdata', 'card')
const madeUp = (): Card => cardFromFolder(testdata, ['MODELS', 'RADIO'])

const text = strings.card
const textOf = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)
/** The same card with one file's words changed. */
const changed = (card: Card, at: string, change: (words: string) => string): Card =>
  new Map(card).set(at, bytesFromText(change(textOf(card.get(at)!))))
/** The same card with the radio set to another position, and the right check number for it. */
function setTo(card: Card, position: number): Card {
  const set = withCurrentModelNumber(card.get(RADIO_SETTINGS_PATH)!, position - 1)
  if (!set.ok) throw new Error('the settings could not be changed')
  return new Map(card).set(RADIO_SETTINGS_PATH, set.bytes)
}
/** A file with its third line ended the wrong way, which the reader refuses at line 3. */
const withABadLine = (words: string): string => words.replace(/^((?:.*\r\n){2}.*)\r\n/, '$1\n')
const lineThreeRefused = strings.files.refused.lineEnding(3)

/** The app as it is once a card has been read and the question about the base has been answered. */
function showing(card: Card) {
  const state: AppState = [
    { type: 'baseFittingAnswered', baseFitting: 'blankCover' } as const,
    { type: 'cardConnected', reading: readCard(card) } as const,
  ].reduce(reducer, initialState(true))
  render(<App initialState={state} />)
  return within(screen.getByRole('main'))
}
const rows = (main: ReturnType<typeof showing>): string[] =>
  within(main.getByRole('list')).getAllByRole('listitem').map((row) => row.textContent ?? '')

test('a real card is listed in position order, and nothing on the page changes it', () => {
  const main = showing(madeUp())

  expect(main.getByRole('heading', { level: 1, name: strings.models.title })).toBeTruthy()
  expect(main.getByText(text.readOnly)).toBeTruthy()
  expect(screen.getByText(strings.header.connected(5, MT12.maxModels))).toBeTruthy()

  // One row per place up to the last model: its position, its name and its receiver type.
  const names = main.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  expect(names).toEqual(['Pebble', 'Gravel Cat', 'Mudskipper', 'Tin Snail', 'Bog Hopper'])
  const listed = rows(main)
  expect(listed).toHaveLength(6)
  expect(listed[0]).toContain(`${strings.models.columns.position} 1`)
  expect(listed[0]).toContain(strings.receiverTypes['dumborc-x'])
  expect(listed[1]).toContain(strings.receiverTypes['spektrum-dsmr'])
  expect(listed[3]).toBe(`${strings.models.columns.position} 4${strings.models.emptyPlace}`)
  expect(listed[5]).toContain(strings.receiverTypes['traxxas-tq'])
  expect(main.getByText(strings.models.emptyAfter(7, MT12.maxModels))).toBeTruthy()

  // The strip names the model the radio is set to, and its row is marked.
  expect(main.getByText(strings.models.currentStrip('Tin Snail', 5))).toBeTruthy()
  expect(main.getAllByText(strings.models.currentMark)).toHaveLength(1)
  expect(listed[4]).toContain(strings.models.currentMark)

  // Nothing changes a real card: no button, no handle, and one link, which only scrolls the page.
  expect(main.queryAllByRole('button')).toEqual([])
  expect(screen.getByRole('main').querySelectorAll('[draggable="true"]')).toHaveLength(0)
  expect(main.getAllByRole('link').map((link) => link.textContent)).toEqual([strings.models.showInList])
  for (const gone of [strings.models.addModel, strings.models.reorderHint, strings.recentlyDeleted.title, strings.tags.noExtras]) {
    expect(main.queryByText(gone)).toBeNull()
  }
})

test('a receiver type that is not in the app\'s list says so', () => {
  const tinSnail = rows(showing(madeUp()))[4]

  expect(tinSnail).toContain('Tin Snail')
  expect(tinSnail).toContain(text.receiverNotKnown)
})

test('a model whose file could not be read keeps its row, with the reader\'s message for the line', () => {
  const main = showing(changed(madeUp(), modelPath(2), withABadLine))
  const listed = rows(main)

  expect(listed).toHaveLength(6)
  expect(listed[1]).toContain(`${strings.models.columns.position} 2`)
  expect(listed[1]).toContain(`${text.fileNotRead} ${lineThreeRefused}`)
  expect(main.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).not.toContain('Gravel Cat')
  expect(screen.getByText(strings.header.connected(5, MT12.maxModels))).toBeTruthy()
})

test('a file in a model\'s place that is not a model says so', () => {
  const main = showing(changed(madeUp(), modelPath(3), () => 'semver: 2.11.0\r\n'))

  expect(rows(main)[2]).toContain(`${text.fileNotRead} ${text.notAModel}`)
})

test('a model with an empty name is shown as having no name', () => {
  const main = showing(changed(madeUp(), modelPath(1), (words) => words.replace('"Pebble"', '""')))

  expect(main.getAllByRole('heading', { level: 2 })[0].textContent).toBe(text.noName)
})

test('settings that could not be read are said in one line, and the list still shows', () => {
  const main = showing(changed(madeUp(), RADIO_SETTINGS_PATH, withABadLine))

  expect(main.getByText(text.settingsNotRead(lineThreeRefused))).toBeTruthy()
  expect(main.getAllByRole('heading', { level: 2 })).toHaveLength(5)
  // Nothing says which model the radio is set to, because the app could not tell.
  expect(main.queryByText(strings.models.showInList)).toBeNull()
  expect(main.queryByText(strings.models.currentMark)).toBeNull()
})

test('settings with a wrong checksum are said in one line, and the list still shows', () => {
  const main = showing(changed(madeUp(), RADIO_SETTINGS_PATH, (words) => words.replace(/^checksum: \d+/, 'checksum: 4242')))

  expect(main.getByText(text.settingsCheckWrong)).toBeTruthy()
  expect(main.getAllByRole('heading', { level: 2 })).toHaveLength(5)
  expect(main.getByText(strings.models.currentStrip('Tin Snail', 5))).toBeTruthy()
})

test('settings with no check number on the first line say so', () => {
  const main = showing(changed(madeUp(), RADIO_SETTINGS_PATH, (words) => words.replace(/^checksum: \d+\r\n/, '')))

  expect(main.getByText(text.settingsCheckMissing)).toBeTruthy()
  expect(main.getAllByRole('heading', { level: 2 })).toHaveLength(5)
})

test('settings that name none of the radio\'s places say so, and there is no strip', () => {
  const main = showing(setTo(madeUp(), 75))

  expect(main.getByText(text.settingsNameNoModel)).toBeTruthy()
  expect(main.queryByText(text.settingsCheckWrong)).toBeNull()
  expect(main.queryByText(strings.models.showInList)).toBeNull()
})

test('a radio set to an empty place says so plainly', () => {
  const main = showing(setTo(madeUp(), 4))

  expect(main.getByText(text.currentEmpty(4))).toBeTruthy()
  expect(main.queryByText(strings.models.showInList)).toBeNull()
  expect(main.queryByText(strings.models.currentMark)).toBeNull()
})

test('a radio set to a model whose file could not be read names its position', () => {
  const main = showing(changed(madeUp(), modelPath(5), withABadLine))

  expect(main.getByText(text.currentUnnamed(5))).toBeTruthy()
  expect(main.getByRole('link', { name: strings.models.showInList })).toBeTruthy()
  expect(rows(main)[4]).toContain(text.fileNotRead)
})

test('a card with no models shows an empty list and says every position is empty', () => {
  const noModels = new Map([...madeUp()].filter(([at]) => !at.startsWith('MODELS/model')))
  const main = showing(noModels)

  expect(main.queryAllByRole('heading', { level: 2 })).toEqual([])
  expect(main.getByText(strings.models.emptyAfter(1, MT12.maxModels))).toBeTruthy()
  expect(main.getByText(text.currentEmpty(5))).toBeTruthy()
  expect(screen.getByText(strings.header.connected(0, MT12.maxModels))).toBeTruthy()
})
