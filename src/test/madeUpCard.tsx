/// <reference types="node" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen } from '@testing-library/react'
import App from '../App.tsx'
import { MT12 } from '../domain/catalog.ts'
import type { Card } from '../files/card.ts'
import type { CardResult } from '../files/cardActions.ts'
import { sameBytes } from '../files/changes.ts'
import { initialState, reducer, type AppState } from '../state/appState.ts'
import { strings } from '../strings/en.ts'
import { cardFromFolder } from './cardFromFolder.ts'
import { folderHolding, type MadeUpFolder } from './folderHolding.ts'

// The made-up card: Pebble, Gravel Cat and Mudskipper in positions 1 to 3, position 4 empty, then
// Tin Snail, whose receiver type the app does not know, and Bog Hopper. The radio is set to Tin
// Snail, in position 5. Each folder also has one file the app leaves alone.
const testdata = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'files', 'testdata', 'card')

export const madeUpCard = (): Card => cardFromFolder(testdata, ['MODELS', 'RADIO'])

export const sameCard = (first: Card, second: Card): boolean =>
  first.size === second.size && [...first].every(([at, bytes]) => second.has(at) && sameBytes(second.get(at)!, bytes))

/** The files of the card itself in a made-up folder, leaving out the backups. */
export const cardIn = (folder: MadeUpFolder): Card =>
  new Map([...folder.files()].filter(([at]) => !at.startsWith('APP-BACKUPS/')))

/** The folders in a made-up folder that hold a backup. */
export const backupsIn = (folder: MadeUpFolder): string[] =>
  folder.folders().filter((at) => /^APP-BACKUPS\/[^/]+\/$/.test(at))

/** A card action's result, when the card logic allowed it. */
export function made<Also>(result: CardResult<Also>): Extract<CardResult<Also>, { ok: true }> {
  if (!result.ok) throw new Error(`refused: ${result.problem}`)
  return result
}

/** A person who has already said what is on the base of their radio, so a card's list shows as soon as it is read. */
export const baseKnown: AppState = reducer(initialState(true), { type: 'baseFittingAnswered', baseFitting: 'blankCover' })

/**
 * Opens the app and connects it to a made-up card, the way a person does: by clicking Connect.
 * A stand-in for the browser's folder picker, which a test cannot click, hands back a folder that
 * is kept in memory. Everything after that is the app's own code, the saving included.
 * `at` is the address to open the app on.
 */
export async function connectedTo(files: Card, options: { state?: AppState; at?: string; ready?: (folder: MadeUpFolder) => void } = {}) {
  const folder = folderHolding(files)
  options.ready?.(folder)
  window.showDirectoryPicker = async () => folder.folder as unknown as FileSystemDirectoryHandle
  if (options.at) window.location.hash = options.at
  render(<App initialState={options.state ?? baseKnown} />)
  fireEvent.click(screen.getByRole('button', { name: strings.connect.connectButton }))
  const models = [...files.keys()].filter((at) => /^MODELS\/model[0-5]\d\.yml$/.test(at)).length
  await screen.findByText(strings.header.connected(models, MT12.maxModels))
  return folder
}

/** Takes the stand-in picker away again. Call it after each test. */
export function forgetPicker() {
  delete window.showDirectoryPicker
}
