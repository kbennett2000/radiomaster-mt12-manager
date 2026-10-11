import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MT12 } from '../../domain/catalog.ts'
import { deletedPath, modelPath, RADIO_SETTINGS_PATH, type Card } from '../../files/card.ts'
import { closeUpOnCard, copyOnCard, deleteFromCard, moveOnCard, restoreOnCard } from '../../files/cardActions.ts'
import { bytesFromText } from '../../files/document.ts'
import { withCurrentModelNumber } from '../../files/radioSettings.ts'
import { strings } from '../../strings/en.ts'
import { backupsIn, baseKnown, cardIn, connectedTo, forgetPicker, made, madeUpCard, sameCard } from '../../test/madeUpCard.tsx'

const text = strings.card
const say = strings.models
const notice = strings.notice

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

const main = () => within(screen.getByRole('main'))
const rows = (): string[] =>
  within(main().getAllByRole('list')[0]).getAllByRole('listitem').map((row) => row.textContent ?? '')
const names = (): (string | null)[] => main().getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
/** The buttons and links on the row for a position, by what they say. */
const actionsOn = (position: number): string[] =>
  Array.from(
    within(main().getAllByRole('list')[0]).getAllByRole('listitem')[position - 1].querySelectorAll('a, button'),
    (action) => action.textContent ?? '',
  )
const click = (name: string) => fireEvent.click(main().getByRole('button', { name }))
const undo = () => fireEvent.click(main().getByRole('button', { name: notice.undo }))

afterEach(forgetPicker)

// What a real card's list shows

test('a real card\'s list has the sample list\'s handles and buttons, and nothing that adds a model', async () => {
  await connectedTo(madeUpCard())

  expect(main().getByRole('heading', { level: 1, name: say.title })).toBeTruthy()
  expect(main().getByText(text.comingNext)).toBeTruthy()
  expect(screen.getByText(strings.header.connected(5, MT12.maxModels))).toBeTruthy()

  // One row per place up to the last model: its position, its name and its receiver type.
  expect(names()).toEqual(['Pebble', 'Gravel Cat', 'Mudskipper', 'Tin Snail', 'Bog Hopper'])
  const listed = rows()
  expect(listed).toHaveLength(6)
  expect(listed[0]).toContain(`${say.columns.position} 1`)
  expect(listed[0]).toContain(strings.receiverTypes['dumborc-x'])
  expect(listed[4]).toContain(text.receiverNotKnown)
  expect(main().getByText(say.emptyAfter(7, MT12.maxModels))).toBeTruthy()

  // A model has Edit, Copy, Move and Delete. An empty place has Move and nothing else.
  expect(actionsOn(1)).toEqual([say.edit, say.copy, say.move, say.delete])
  expect(actionsOn(4)).toEqual([say.move])
  expect(main().getByRole('button', { name: say.moveEmptyNamed(4) })).toBeTruthy()
  // Every row, the empty place too, has a handle to drag it by.
  expect(screen.getByRole('main').querySelectorAll('ol > li [draggable="true"]')).toHaveLength(6)
  expect(main().getByRole('button', { name: say.closeUp })).toBeTruthy()

  // The strip names the model the radio is set to, with a way to its Edit page, and its row is marked.
  expect(main().getByText(say.currentStrip('Tin Snail', 5))).toBeTruthy()
  expect(main().getAllByRole('link', { name: say.editNamed('Tin Snail') })).toHaveLength(2)
  expect(main().getAllByText(say.currentMark)).toHaveLength(1)

  // Nothing is added from a real card yet, and a row does not say what the model has.
  for (const gone of [say.addModel, say.addHere, say.reorderHint, strings.tags.noExtras, strings.recentlyDeleted.title]) {
    expect(main().queryByText(gone)).toBeNull()
  }
})

test('a model whose file could not be read keeps its row, and can only be moved or deleted', async () => {
  await connectedTo(changed(madeUpCard(), modelPath(2), withABadLine))

  expect(rows()[1]).toContain(`${text.fileNotRead} ${lineThreeRefused}`)
  expect(names()).not.toContain('Gravel Cat')
  expect(actionsOn(2)).toEqual([say.move, say.delete])
  expect(main().getByRole('button', { name: say.deleteNamed(text.unnamed(2)) })).toBeTruthy()
  expect(screen.getByText(strings.header.connected(5, MT12.maxModels))).toBeTruthy()
})

test('a file in a model\'s place that is not a model says so, and a model with an empty name is shown as having none', async () => {
  const card = changed(changed(madeUpCard(), modelPath(3), () => 'semver: 2.11.0\r\n'), modelPath(1), (words) => words.replace('"Pebble"', '""'))
  await connectedTo(card)

  expect(rows()[2]).toContain(`${text.fileNotRead} ${text.notAModel}`)
  expect(actionsOn(3)).toEqual([say.move, say.delete])
  expect(names()[0]).toBe(text.noName)
  expect(actionsOn(1)).toEqual([say.edit, say.copy, say.move, say.delete])
})

test('settings that could not be read are said in one line, and the list still shows', async () => {
  await connectedTo(changed(madeUpCard(), RADIO_SETTINGS_PATH, withABadLine))

  expect(main().getByText(text.settingsNotRead(lineThreeRefused))).toBeTruthy()
  expect(names()).toHaveLength(5)
  // Nothing says which model the radio is set to, because the app could not tell.
  expect(main().queryByText(say.showInList)).toBeNull()
  expect(main().queryByText(say.currentMark)).toBeNull()
})

test('settings with a wrong checksum, with none, or that name no place, each say so in one line', async () => {
  const wrong = await connectedTo(changed(madeUpCard(), RADIO_SETTINGS_PATH, (words) => words.replace(/^checksum: \d+/, 'checksum: 4242')))
  expect(main().getByText(text.settingsCheckWrong)).toBeTruthy()
  expect(main().getByText(say.currentStrip('Tin Snail', 5))).toBeTruthy()
  expect(wrong.log).toEqual([])
})

test('settings with no check number on the first line say so', async () => {
  await connectedTo(changed(madeUpCard(), RADIO_SETTINGS_PATH, (words) => words.replace(/^checksum: \d+\r\n/, '')))

  expect(main().getByText(text.settingsCheckMissing)).toBeTruthy()
  expect(names()).toHaveLength(5)
})

test('settings that name none of the radio\'s places say so, and there is no strip', async () => {
  await connectedTo(setTo(madeUpCard(), 75))

  expect(main().getByText(text.settingsNameNoModel)).toBeTruthy()
  expect(main().queryByText(text.settingsCheckWrong)).toBeNull()
  expect(main().queryByText(say.showInList)).toBeNull()
})

test('a radio set to an empty place says so plainly', async () => {
  await connectedTo(setTo(madeUpCard(), 4))

  expect(main().getByText(text.currentEmpty(4))).toBeTruthy()
  expect(main().queryByText(say.showInList)).toBeNull()
  expect(main().queryByText(say.currentMark)).toBeNull()
})

test('a radio set to a model whose file could not be read names its position, and offers no Edit', async () => {
  await connectedTo(changed(madeUpCard(), modelPath(5), withABadLine))

  expect(main().getByText(text.currentUnnamed(5))).toBeTruthy()
  expect(main().getByRole('link', { name: say.showInList })).toBeTruthy()
  expect(main().queryByRole('link', { name: say.editNamed(text.unnamed(5)) })).toBeNull()
  expect(rows()[4]).toContain(text.fileNotRead)
})

test('a card with no models shows an empty list and says every position is empty', async () => {
  await connectedTo(new Map([...madeUpCard()].filter(([at]) => !at.startsWith('MODELS/model'))))

  expect(main().queryAllByRole('heading', { level: 2 })).toEqual([])
  expect(main().getByText(say.emptyAfter(1, MT12.maxModels))).toBeTruthy()
  expect(main().getByText(text.currentEmpty(5))).toBeTruthy()
})

test('a full card of 60 says it is full, and Copy says why it cannot copy', async () => {
  const one = textOf(madeUpCard().get(modelPath(1))!)
  const full = new Map(madeUpCard())
  for (let position = 1; position <= 60; position += 1) {
    full.set(modelPath(position), bytesFromText(one.replace('"Pebble"', `"Rig ${String(position).padStart(2, '0')}"`)))
  }
  const folder = await connectedTo(full)

  expect(main().getByText(say.fullBanner(MT12.maxModels))).toBeTruthy()
  expect(names()).toHaveLength(60)
  expect(main().queryByText(/are empty\.$/)).toBeNull()

  click(say.copyNamed('Rig 07'))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByRole('heading', { name: strings.radioFull.title })).toBeTruthy()
  expect(dialog.queryByLabelText(strings.copy.nameLabel)).toBeNull()
  fireEvent.click(dialog.getByRole('button', { name: strings.radioFull.ok }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(folder.log).toEqual([])
})

// Changing a real card

test('Copy saves a copy to the card and says so, and Undo puts the card back byte for byte', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card)

  click(say.copyNamed('Gravel Cat'))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByRole('heading', { name: strings.copy.title('Gravel Cat') })).toBeTruthy()
  fireEvent.change(dialog.getByLabelText(strings.copy.nameLabel), { target: { value: 'Shingle' } })
  fireEvent.click(dialog.getByRole('button', { name: strings.copy.confirm }))

  // The same notice the sample list shows, and the copy is really on the card.
  expect(await main().findByText(notice.added('Shingle', 4))).toBeTruthy()
  expect(main().getByText(notice.savedTitle)).toBeTruthy()
  expect(sameCard(cardIn(folder), made(copyOnCard(card, 2, 'Shingle')).card)).toBe(true)
  expect(names()).toEqual(['Pebble', 'Gravel Cat', 'Mudskipper', 'Shingle', 'Tin Snail', 'Bog Hopper'])
  expect(screen.getByText(strings.header.connected(6, MT12.maxModels))).toBeTruthy()
  // This was the first change since Connect, so a backup was made first, and the notice says where.
  expect(main().getByText(text.backupMade)).toBeTruthy()
  expect(backupsIn(folder)).toHaveLength(1)

  undo()
  expect(await main().findByText(notice.undone)).toBeTruthy()
  expect(sameCard(cardIn(folder), card)).toBe(true)
  expect(names()).toHaveLength(5)
  expect(screen.getByText(strings.header.connected(5, MT12.maxModels))).toBeTruthy()
  // Undo is for the last change only, and the backup is made once for a Connect.
  expect(main().queryByRole('button', { name: notice.undo })).toBeNull()
  expect(main().queryByText(text.backupMade)).toBeNull()
  expect(backupsIn(folder)).toHaveLength(1)
})

test('a copy\'s name follows the rule for a real card: no character the radio cannot keep', async () => {
  const folder = await connectedTo(madeUpCard())

  click(say.copyNamed('Pebble'))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText(strings.copy.nameLabel), { target: { value: 'Rock "n"' } })
  expect(dialog.getByText(strings.modelName.notPlain)).toBeTruthy()
  fireEvent.click(dialog.getByRole('button', { name: strings.copy.confirm }))

  // The dialog stays, and nothing is asked of the folder.
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(folder.log).toEqual([])
})

test('Move saves the move, the strip follows the radio\'s model, and Undo says the model is back', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card)

  click(say.moveNamed('Mudskipper'))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText(strings.moveModel.positionLabel), { target: { value: '5' } })
  fireEvent.click(dialog.getByRole('button', { name: strings.moveModel.confirm }))

  expect(await main().findByText(notice.moved('Mudskipper', 5))).toBeTruthy()
  expect(sameCard(cardIn(folder), made(moveOnCard(card, 3, 5)).card)).toBe(true)
  // Tin Snail, the radio's model, moved up to make room. The strip and its row's mark went with it.
  expect(main().getByText(say.currentStrip('Tin Snail', 4))).toBeTruthy()
  expect(rows()[3]).toContain(say.currentMark)

  undo()
  expect(await main().findByText(notice.restored('Mudskipper', 3))).toBeTruthy()
  expect(sameCard(cardIn(folder), card)).toBe(true)
  expect(main().getByText(say.currentStrip('Tin Snail', 5))).toBeTruthy()
})

test('Move works on an empty place too', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card)

  click(say.moveEmptyNamed(4))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText(strings.moveModel.positionLabel), { target: { value: '1' } })
  fireEvent.click(dialog.getByRole('button', { name: strings.moveModel.confirmEmpty }))

  expect(await main().findByText(notice.emptyMoved(4, 1))).toBeTruthy()
  expect(sameCard(cardIn(folder), made(moveOnCard(card, 4, 1)).card)).toBe(true)
  expect(rows()[0]).toContain(say.emptyPlace)
})

test('"Close up empty places" saves the closed-up list', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card)

  click(say.closeUp)

  expect(await main().findByText(notice.closedUp(5))).toBeTruthy()
  expect(sameCard(cardIn(folder), made(closeUpOnCard(card)).card)).toBe(true)
  expect(rows()).toHaveLength(5)
  expect(main().queryByRole('button', { name: say.closeUp })).toBeNull()

  undo()
  expect(await main().findByText(notice.undone)).toBeTruthy()
  expect(sameCard(cardIn(folder), card)).toBe(true)
})

test('Delete closes up the list, keeps the model under "Recently deleted", and Restore brings it back', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card)

  click(say.deleteNamed('Gravel Cat'))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByRole('heading', { name: strings.deleteModel.title('Gravel Cat') })).toBeTruthy()
  expect(dialog.getByText(strings.deleteModel.othersWillMoveUp(3))).toBeTruthy()
  fireEvent.click(dialog.getByRole('button', { name: strings.deleteModel.confirm }))

  const gone = made(deleteFromCard(card, 2, { closeUp: true }))
  expect(await main().findByText([notice.deleted('Gravel Cat'), notice.othersAfterMovedUp(3), notice.copyKept].join(' '))).toBeTruthy()
  expect(sameCard(cardIn(folder), gone.card)).toBe(true)
  expect(names()).toEqual(['Pebble', 'Mudskipper', 'Tin Snail', 'Bog Hopper', 'Recently deleted'])
  expect(screen.getByText(strings.header.connected(4, MT12.maxModels))).toBeTruthy()

  // "Recently deleted" lists what is in MODELS/DELETED on the card.
  const deleted = within(screen.getByRole('region', { name: strings.recentlyDeleted.title }))
  expect(deleted.getByText('Gravel Cat')).toBeTruthy()
  expect(deleted.getByText(strings.recentlyDeleted.wasIn(2))).toBeTruthy()

  fireEvent.click(deleted.getByRole('button', { name: strings.recentlyDeleted.restoreNamed('Gravel Cat') }))
  // Its place had been taken, so the model there made room, and the notice says so.
  expect(await main().findByText(`${notice.restored('Gravel Cat', 2)} ${notice.oneMoved('Mudskipper', 'down')}`)).toBeTruthy()
  expect(sameCard(cardIn(folder), made(restoreOnCard(gone.card, gone.deletedPath)).card)).toBe(true)
  expect(screen.queryByRole('region', { name: strings.recentlyDeleted.title })).toBeNull()

  // The restore is a change like any other, and it can be undone.
  undo()
  expect(await main().findByText(notice.undone)).toBeTruthy()
  expect(sameCard(cardIn(folder), gone.card)).toBe(true)
})

test('Delete leaves the place empty when Radio setup says so', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card, { state: { ...baseKnown, whenDeleting: 'leaveEmpty' } })

  click(say.deleteNamed('Gravel Cat'))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByText(strings.deleteModel.willLeaveEmpty(2))).toBeTruthy()
  fireEvent.click(dialog.getByRole('button', { name: strings.deleteModel.confirm }))

  expect(await main().findByText([notice.deleted('Gravel Cat'), notice.leftEmpty(2), notice.copyKept].join(' '))).toBeTruthy()
  expect(sameCard(cardIn(folder), made(deleteFromCard(card, 2, { closeUp: false })).card)).toBe(true)
  expect(rows()[1]).toContain(say.emptyPlace)
  expect(rows()).toHaveLength(6)

  undo()
  expect(await main().findByText(notice.restored('Gravel Cat', 2))).toBeTruthy()
  expect(sameCard(cardIn(folder), card)).toBe(true)
})

test('deleting the model the radio is set to asks which model to switch to, and the radio follows', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card)

  click(say.deleteNamed('Tin Snail'))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByText(strings.deleteModel.currentIntro)).toBeTruthy()
  fireEvent.click(dialog.getByRole('button', { name: strings.deleteModel.confirm }))
  // Nothing is deleted until a model is picked.
  expect(dialog.getByText(strings.deleteModel.switchMissing)).toBeTruthy()
  expect(folder.log).toEqual([])

  fireEvent.change(dialog.getByLabelText(strings.deleteModel.switchLabel), { target: { value: '1' } })
  fireEvent.click(dialog.getByRole('button', { name: strings.deleteModel.confirm }))

  expect(await main().findByText(say.currentStrip('Pebble', 1))).toBeTruthy()
  expect(sameCard(cardIn(folder), made(deleteFromCard(card, 5, { closeUp: true, switchTo: 1 })).card)).toBe(true)
  expect(rows()[0]).toContain(say.currentMark)
})

test('"Recently deleted" lists the deleted models newest first, and one that cannot be read can still be restored', async () => {
  const card = madeUpCard()
  const withDeleted = new Map(card)
    .set(deletedPath(1, 7), card.get(modelPath(6))!)
    .set(deletedPath(2, 4), bytesFromText(withABadLine(textOf(card.get(modelPath(2))!))))
  const folder = await connectedTo(withDeleted)

  const deleted = within(screen.getByRole('region', { name: strings.recentlyDeleted.title }))
  const listed = deleted.getAllByRole('listitem').map((row) => row.textContent ?? '')
  // The one deleted last is first. It has no name the app could read, so it is shown by its position.
  expect(listed[0]).toContain(text.deletedNotRead)
  expect(listed[0]).toContain(strings.recentlyDeleted.wasIn(4))
  expect(listed[1]).toContain('Bog Hopper')
  expect(listed[1]).toContain(strings.receiverTypes['traxxas-tq'])
  expect(listed[1]).toContain(strings.recentlyDeleted.wasIn(7))

  fireEvent.click(deleted.getByRole('button', { name: strings.recentlyDeleted.restoreNamed(text.deletedNotRead) }))

  expect(await main().findByText(text.saved.restoredUnnamed(4))).toBeTruthy()
  expect(sameCard(cardIn(folder), made(restoreOnCard(withDeleted, deletedPath(2, 4))).card)).toBe(true)
  expect(rows()[3]).toContain(text.fileNotRead)
})

test('a model whose file could not be read is deleted and brought back by its position', async () => {
  const card = changed(madeUpCard(), modelPath(2), withABadLine)
  const folder = await connectedTo(card)

  click(say.deleteNamed(text.unnamed(2)))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByRole('heading', { name: strings.deleteModel.title(text.unnamed(2)) })).toBeTruthy()
  fireEvent.click(dialog.getByRole('button', { name: strings.deleteModel.confirm }))

  expect(await main().findByText(new RegExp(`^${text.saved.deletedUnnamed(2).replaceAll('.', '\\.')}`))).toBeTruthy()
  expect(sameCard(cardIn(folder), made(deleteFromCard(card, 2, { closeUp: true })).card)).toBe(true)

  undo()
  expect(await main().findByText(text.saved.restoredUnnamed(2))).toBeTruthy()
  expect(sameCard(cardIn(folder), card)).toBe(true)
})
