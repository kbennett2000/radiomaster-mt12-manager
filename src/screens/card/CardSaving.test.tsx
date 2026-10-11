import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MT12 } from '../../domain/catalog.ts'
import { modelPath, RADIO_SETTINGS_PATH, type Card } from '../../files/card.ts'
import { moveOnCard } from '../../files/cardActions.ts'
import { applyChanges } from '../../files/changes.ts'
import { bytesFromText } from '../../files/document.ts'
import { withCurrentModelNumber } from '../../files/radioSettings.ts'
import { strings } from '../../strings/en.ts'
import type { MadeUpFolder } from '../../test/folderHolding.ts'
import { backupsIn, cardIn, connectedTo, forgetPicker, made, madeUpCard, sameCard } from '../../test/madeUpCard.tsx'

const trouble = strings.card.trouble
const say = strings.models

const main = () => within(screen.getByRole('main'))
/** The names in the list, top to bottom. */
const names = (): (string | null)[] =>
  within(main().getAllByRole('list')[0])
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent)

/** Asks for a copy of Gravel Cat called Shingle, which is one write to the card. */
function copy() {
  fireEvent.click(main().getByRole('button', { name: say.copyNamed('Gravel Cat') }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText(strings.copy.nameLabel), { target: { value: 'Shingle' } })
  fireEvent.click(dialog.getByRole('button', { name: strings.copy.confirm }))
}
/** Asks for Mudskipper to move to position 5, which is three writes and a remove. */
function move() {
  fireEvent.click(main().getByRole('button', { name: say.moveNamed('Mudskipper') }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText(strings.moveModel.positionLabel), { target: { value: '5' } })
  fireEvent.click(dialog.getByRole('button', { name: strings.moveModel.confirm }))
}
/** The dialog that says a change was not made, once it is up. */
const troubleDialog = async (title: string) => {
  const heading = await screen.findByRole('heading', { name: title })
  return within(heading.closest('dialog')!)
}
/** The screen is as it was: the same models, the same strip, and no confirmation of a change. */
function expectScreenUnchanged() {
  expect(names()).toEqual(['Pebble', 'Gravel Cat', 'Mudskipper', 'Tin Snail', 'Bog Hopper'])
  expect(main().getByText(say.currentStrip('Tin Snail', 5))).toBeTruthy()
  expect(main().queryByText(strings.notice.savedTitle)).toBeNull()
  expect(screen.getByText(strings.header.connected(5, MT12.maxModels))).toBeTruthy()
}

afterEach(forgetPicker)

test('while a save is running, "Saving…" covers the page', async () => {
  // A folder where the browser never answers the question about changing files.
  const neverAnswers = (folder: MadeUpFolder) => {
    folder.folder.requestPermission = () => new Promise<PermissionState>(() => undefined)
  }
  await connectedTo(madeUpCard(), { ready: neverAnswers })

  copy()

  const cover = await screen.findByRole('dialog', { name: strings.card.saving })
  expect(within(cover).getByRole('status').textContent).toBe(strings.card.saving)
  // It is a modal dialog with nothing in it to press, and the dialog that asked for the copy is gone.
  expect((cover as HTMLDialogElement).open).toBe(true)
  expect(within(cover).queryAllByRole('button')).toEqual([])
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expectScreenUnchanged()
})

test('not allowed: nothing is changed, and the message says to try again and allow it', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card, { ready: (made) => (made.permission = 'denied') })

  copy()

  const dialog = await troubleDialog(trouble.nothingChanged)
  expect(dialog.getByText(trouble.notAllowed)).toBeTruthy()
  expect(trouble.notAllowed).toBe(
    'Your browser was not allowed to change the files, so nothing was changed. Try again and allow it when your browser asks.',
  )
  expect(dialog.getAllByRole('button').map((button) => button.textContent)).toEqual([trouble.ok])
  expectScreenUnchanged()
  expect(sameCard(folder.files(), card)).toBe(true)

  // Once it is closed, the same thing can be tried again, and this time the browser says yes.
  fireEvent.click(dialog.getByRole('button', { name: trouble.ok }))
  expect(screen.queryByRole('dialog')).toBeNull()
  folder.permission = 'granted'
  copy()
  expect(await main().findByText(strings.notice.added('Shingle', 4))).toBeTruthy()
})

test('the card has changed: nothing is changed, and "Read the card again" shows what is there now', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card)
  // Something else sets the radio to Pebble while the page is open.
  const elsewhere = withCurrentModelNumber(card.get(RADIO_SETTINGS_PATH)!, 0)
  if (!elsewhere.ok) throw new Error('the settings could not be changed')
  folder.put(RADIO_SETTINGS_PATH, elsewhere.bytes)
  const asItIsNow = folder.files()

  copy()

  const dialog = await troubleDialog(trouble.nothingChanged)
  expect(dialog.getByText(trouble.cardChanged)).toBeTruthy()
  expect(trouble.cardChanged).toBe('Something else has changed your radio’s files since this page read them. Nothing was changed.')
  expect(dialog.getAllByRole('button').map((button) => button.textContent)).toEqual([trouble.readAgain])
  expectScreenUnchanged()
  expect(sameCard(folder.files(), asItIsNow)).toBe(true)
  expect(backupsIn(folder)).toEqual([])

  fireEvent.click(dialog.getByRole('button', { name: trouble.readAgain }))

  expect(await main().findByText(say.currentStrip('Pebble', 1))).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  // The card is now what the app holds, so the same change goes through, with its backup first.
  copy()
  expect(await main().findByText(strings.notice.added('Shingle', 4))).toBeTruthy()
  expect(backupsIn(folder)).toHaveLength(1)
})

test('the backup failed: nothing is changed, and the message says so', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card, {
    ready: (made) => (made.fails = ({ kind, path }) => kind === 'make' && path === 'APP-BACKUPS/'),
  })

  copy()

  const dialog = await troubleDialog(trouble.nothingChanged)
  expect(dialog.getByText(trouble.backupFailed)).toBeTruthy()
  expect(trouble.backupFailed).toBe('The app could not make its backup first, so nothing was changed.')
  expect(dialog.getAllByRole('button').map((button) => button.textContent)).toEqual([trouble.ok])
  expectScreenUnchanged()
  expect(sameCard(folder.files(), card)).toBe(true)
})

test('saving stopped part way: the screen is left as it was, and "Read the card again" shows what is on the card', async () => {
  const card = madeUpCard()
  // The move's third change fails, with the first two already made.
  const folder = await connectedTo(card, {
    ready: (made) => (made.fails = ({ kind, path }) => kind === 'write' && path === modelPath(5)),
  })
  const changes = made(moveOnCard(card, 3, 5)).changes

  move()

  const dialog = await troubleDialog(trouble.didNotFinishTitle)
  expect(dialog.getByText(trouble.didNotFinish)).toBeTruthy()
  expect(`${trouble.didNotFinishTitle}. ${trouble.didNotFinish}`).toBe(
    'Saving did not finish. No model is lost: each one is still on the card, in your list or under Recently deleted. A backup from before is in the APP-BACKUPS folder.',
  )
  expect(dialog.getAllByRole('button').map((button) => button.textContent)).toEqual([trouble.readAgain])
  expectScreenUnchanged()
  // The card really is part way, and the backup really is from before.
  expect(sameCard(cardIn(folder), applyChanges(card, changes.slice(0, 2)))).toBe(true)
  expect(backupsIn(folder)).toHaveLength(1)

  fireEvent.click(dialog.getByRole('button', { name: trouble.readAgain }))

  // What is there: Tin Snail in its new place and its old one, the radio set to the new one, and
  // Mudskipper still where it was. No model is lost.
  expect(await main().findByText(say.currentStrip('Tin Snail', 4))).toBeTruthy()
  expect(names()).toEqual(['Pebble', 'Gravel Cat', 'Mudskipper', 'Tin Snail', 'Tin Snail', 'Bog Hopper'])
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a file that does not read back as written is told the same way', async () => {
  const folder = await connectedTo(madeUpCard(), {
    ready: (made) => (made.garbles = (path, bytes) => (path === modelPath(4) ? bytes.slice(0, -2) : bytes)),
  })

  copy()

  const dialog = await troubleDialog(trouble.didNotFinishTitle)
  expect(dialog.getByRole('button', { name: trouble.readAgain })).toBeTruthy()
  expect(backupsIn(folder)).toHaveLength(1)
})

test('when reading the card again finds no card, the app goes back to Connect', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card)
  folder.put(modelPath(1), bytesFromText('changed by something else\r\n'))
  fireEvent.click(main().getByRole('button', { name: say.deleteNamed('Pebble') }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: strings.deleteModel.confirm }))
  const dialog = await troubleDialog(trouble.nothingChanged)

  // The drive is pulled out before the card is read again.
  folder.folder.entries = async function* () {}
  fireEvent.click(dialog.getByRole('button', { name: trouble.readAgain }))

  expect(await screen.findByRole('heading', { level: 1, name: strings.connect.title })).toBeTruthy()
  expect(screen.getByText(strings.connect.wrongFolder.body)).toBeTruthy()
})

test('a change the app itself will not make gets one plain sentence, and the folder is asked nothing', async () => {
  const wrongCheck = (card: Card): Card =>
    new Map(card).set(
      RADIO_SETTINGS_PATH,
      bytesFromText(new TextDecoder().decode(card.get(RADIO_SETTINGS_PATH)).replace(/^checksum: \d+/, 'checksum: 4242')),
    )
  const folder = await connectedTo(wrongCheck(madeUpCard()))

  // Moving the radio's model would have to change the settings file, whose check number is wrong.
  fireEvent.click(main().getByRole('button', { name: say.moveNamed('Tin Snail') }))
  const moving = within(screen.getByRole('dialog'))
  fireEvent.change(moving.getByLabelText(strings.moveModel.positionLabel), { target: { value: '1' } })
  fireEvent.click(moving.getByRole('button', { name: strings.moveModel.confirm }))

  const dialog = await troubleDialog(trouble.nothingChanged)
  expect(dialog.getByText(trouble.refused.checksumWrong)).toBeTruthy()
  expect(dialog.getAllByRole('button').map((button) => button.textContent)).toEqual([trouble.ok])
  expect(folder.log).toEqual([])
  fireEvent.click(dialog.getByRole('button', { name: trouble.ok }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('the only model on a card cannot be deleted while the radio is set to it, and the sentence says why', async () => {
  const only = new Map([...madeUpCard()].filter(([at]) => !/^MODELS\/model0[0-25]\.yml$/.test(at)))
  const folder = await connectedTo(only)

  fireEvent.click(main().getByRole('button', { name: say.deleteNamed('Tin Snail') }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: strings.deleteModel.confirm }))

  const dialog = await troubleDialog(trouble.nothingChanged)
  expect(dialog.getByText(trouble.refused.switchToNeeded)).toBeTruthy()
  expect(folder.log).toEqual([])
})

test('the backup is made before the first change only, and its line is on that one notice', async () => {
  const folder = await connectedTo(madeUpCard())

  copy()
  expect(await main().findByText(strings.card.backupMade)).toBeTruthy()

  move()
  expect(await main().findByText(strings.notice.moved('Mudskipper', 5))).toBeTruthy()
  expect(main().queryByText(strings.card.backupMade)).toBeNull()
  expect(backupsIn(folder)).toHaveLength(1)
  expect(folder.log.filter((entry) => entry === 'ask')).toHaveLength(2)
})
