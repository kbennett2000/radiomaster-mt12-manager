/// <reference types="node" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App.tsx'
import { MT12 } from '../../domain/catalog.ts'
import type { Card } from '../../files/card.ts'
import { SAMPLE_MODELS } from '../../sample/sampleModels.ts'
import { initialState, reducer } from '../../state/appState.ts'
import { strings } from '../../strings/en.ts'
import { cardFromFolder } from '../../test/cardFromFolder.ts'
import { folderHolding } from '../../test/folderHolding.ts'

const text = strings.connect

// The made-up card: five invented models, with the radio set to Tin Snail in position 5.
const testdata = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'files', 'testdata', 'card')
const madeUp = (): Card => cardFromFolder(testdata, ['MODELS', 'RADIO'])

/** Stands in for the browser's folder picker, which a test cannot click. It hands back this folder. */
function pickerGiving(files: Card) {
  const { folder } = folderHolding(files)
  const picker = vi.fn(async () => folder as unknown as FileSystemDirectoryHandle)
  window.showDirectoryPicker = picker
  return picker
}
/** A person who has already said what is on the base of their radio. */
const baseKnown = reducer(initialState(true), { type: 'baseFittingAnswered', baseFitting: 'blankCover' })

afterEach(() => {
  delete window.showDirectoryPicker
})

test('Connect shows three steps, the Connect button and the quiet link', () => {
  render(<App initialState={initialState(true)} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 1, name: text.title })).toBeTruthy()
  expect(main.getAllByRole('listitem')).toHaveLength(3)
  expect(main.getByRole('button', { name: text.connectButton })).toBeTruthy()
  expect(main.getByRole('link', { name: text.openFilesLink })).toBeTruthy()
})

test('Connect asks the browser for a folder to read and nothing more, then asks the one question', async () => {
  const picker = pickerGiving(madeUp())
  render(<App initialState={initialState(true)} />)

  fireEvent.click(screen.getByRole('button', { name: text.connectButton }))

  // The card is read, and the first-time question about the base comes before the list.
  expect(await screen.findByRole('heading', { level: 1, name: text.connected.title })).toBeTruthy()
  expect(screen.getByText(text.connected.found(5))).toBeTruthy()
  expect(picker.mock.calls).toEqual([[{ mode: 'read' }]])

  fireEvent.click(screen.getByLabelText(new RegExp(strings.baseFitting.options.blankCover.label)))
  fireEvent.click(screen.getByRole('button', { name: text.connected.continue }))

  expect(screen.getByRole('heading', { level: 1, name: strings.models.title })).toBeTruthy()
  expect(screen.getByText(strings.header.connected(5, MT12.maxModels))).toBeTruthy()
  expect(screen.getByText(strings.card.readOnly)).toBeTruthy()
  expect(screen.getByText(strings.models.currentStrip('Tin Snail', 5))).toBeTruthy()
})

test('closing the picker without choosing leaves Connect as it was and says nothing', async () => {
  const picker = vi.fn(async (): Promise<FileSystemDirectoryHandle> => {
    throw new DOMException('The user aborted a request.', 'AbortError')
  })
  window.showDirectoryPicker = picker
  render(<App initialState={initialState(true)} />)
  const before = screen.getByRole('main').textContent

  fireEvent.click(screen.getByRole('button', { name: text.connectButton }))

  expect(await screen.findByRole('button', { name: text.connectButton })).toBeTruthy()
  expect(picker).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('main').textContent).toBe(before)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('a folder that is not the radio\'s drive gets the wrong-folder help, which says which folder to pick', async () => {
  pickerGiving(new Map([...madeUp()].filter(([at]) => !at.startsWith('MODELS/'))))
  render(<App initialState={initialState(true)} />)

  fireEvent.click(screen.getByRole('button', { name: text.connectButton }))

  const help = within(await screen.findByRole('alert'))
  expect(help.getByRole('heading', { name: text.wrongFolder.title })).toBeTruthy()
  expect(help.getByText(text.wrongFolder.body)).toBeTruthy()
  expect(text.wrongFolder.body).toContain('Pick the top folder of your radio’s drive, the one with MODELS and RADIO inside.')
  expect(screen.getByRole('button', { name: text.wrongFolder.retry })).toBeTruthy()

  // The same goes for a drive with MODELS on it but no settings file in RADIO.
  pickerGiving(new Map([...madeUp()].filter(([at]) => at !== 'RADIO/radio.yml')))
  fireEvent.click(screen.getByRole('button', { name: text.wrongFolder.retry }))
  expect(await screen.findByRole('button', { name: text.wrongFolder.retry })).toBeTruthy()
  expect(screen.getByRole('alert')).toBeTruthy()
})

test('a browser with no folder picker gets the "browser not supported" page, with the sample link', () => {
  render(<App initialState={initialState(false)} />)
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { level: 1, name: text.unsupported.title })).toBeTruthy()
  expect(main.queryByRole('button', { name: text.connectButton })).toBeNull()
  expect(main.getByRole('link', { name: text.sampleLink })).toBeTruthy()
})

test('"Try it with sample models" opens the sample models, and the header says they are sample models', () => {
  render(<App initialState={baseKnown} />)

  fireEvent.click(screen.getByRole('link', { name: text.sampleLink }))

  const main = within(screen.getByRole('main'))
  expect(screen.getByText(strings.header.sample(20, MT12.maxModels))).toBeTruthy()
  expect(screen.queryByText(strings.header.connected(20, MT12.maxModels))).toBeNull()
  // Every part of the sample list is there, as it was: the models, the Add button and a row's buttons.
  expect(main.getAllByRole('heading', { level: 2 })).toHaveLength(20)
  expect(main.getByRole('link', { name: strings.models.addModel })).toBeTruthy()
  expect(main.getByRole('button', { name: strings.models.deleteNamed(SAMPLE_MODELS[0].name) })).toBeTruthy()
  expect(main.queryByText(strings.card.readOnly)).toBeNull()
})
