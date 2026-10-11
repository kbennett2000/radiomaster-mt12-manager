import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { renameOnCard } from '../../files/cardActions.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import { backupsIn, cardIn, connectedTo, forgetPicker, made, madeUpCard, sameCard } from '../../test/madeUpCard.tsx'

const text = strings.editModel
const rows = strings.addModel.review.rows
const question = strings.addModel.name.question
// A real card names a model by its place. Pebble is in position 1 and Tin Snail, the radio's model, in 5.
const pebble = 'place-1'

const main = () => within(screen.getByRole('main'))
const nameField = () => main().getByLabelText(question) as HTMLInputElement
const typeName = (name: string) => fireEvent.change(nameField(), { target: { value: name } })
const save = () => fireEvent.click(main().getByRole('button', { name: text.save }))

afterEach(forgetPicker)

test('the Edit page for a real model is short: its name with Change, its position and its receiver', async () => {
  await connectedTo(madeUpCard(), { at: paths.editModel(pebble) })

  expect(main().getByRole('heading', { level: 1, name: text.title('Pebble') })).toBeTruthy()
  expect(main().getByText(text.position(1))).toBeTruthy()

  const terms = main().getAllByRole('term').map((term) => term.textContent)
  expect(terms).toEqual([rows.name, rows.position, rows.receiver])
  expect(main().getByText(text.positionNote)).toBeTruthy()
  expect(main().getByText(strings.receiverTypes['dumborc-x'])).toBeTruthy()
  // Only the name can be changed here.
  const changes = main().getAllByRole('link', { name: /^Change / })
  expect(changes.map((link) => link.getAttribute('aria-label'))).toEqual([strings.addModel.review.changeNamed(rows.name)])

  expect(main().getByText(strings.card.restOfModel)).toBeTruthy()
  expect(main().getByRole('link', { name: text.backToModels }).getAttribute('href')).toBe(paths.home)
  // Nothing about steering, throttle, extras or feedback, which the app cannot read yet.
  for (const notYet of [rows.steering, rows.throttle, strings.addModel.review.extrasLabel, strings.addModel.review.controlsTitle]) {
    expect(main().queryByText(notYet)).toBeNull()
  }
})

test('the Edit page says when the radio is set to the model, and when its receiver type is not known', async () => {
  await connectedTo(madeUpCard(), { at: paths.editModel('place-5') })

  expect(main().getByRole('heading', { level: 1, name: text.title('Tin Snail') })).toBeTruthy()
  expect(main().getByText(new RegExp(text.current))).toBeTruthy()
  expect(main().getByText(strings.card.receiverNotKnown)).toBeTruthy()
})

test('Edit on a row opens that model\'s page, and Change opens the name page with its name', async () => {
  await connectedTo(madeUpCard())

  fireEvent.click(main().getAllByRole('link', { name: strings.models.editNamed('Gravel Cat') })[0])
  expect(await main().findByRole('heading', { level: 1, name: text.title('Gravel Cat') })).toBeTruthy()

  fireEvent.click(main().getByRole('link', { name: strings.addModel.review.changeNamed(rows.name) }))
  expect(await main().findByLabelText(question)).toBeTruthy()
  expect(nameField().value).toBe('Gravel Cat')
  expect(main().getByRole('link', { name: text.cancel })).toBeTruthy()
})

test('"Save changes" renames the model on the card, and Undo puts the name back', async () => {
  const card = madeUpCard()
  const folder = await connectedTo(card, { at: paths.editPart(pebble, 'name') })

  expect(await main().findByLabelText(question)).toBeTruthy()
  typeName('Boulder')
  save()

  // Back on the model's page, under its new name, with the sample page's own confirmation.
  expect(await main().findByText(text.saved.renamed('Pebble', 'Boulder'))).toBeTruthy()
  expect(main().getByRole('heading', { level: 1, name: text.title('Boulder') })).toBeTruthy()
  expect(main().getByText(strings.notice.savedTitle)).toBeTruthy()
  expect(main().getByText(strings.card.backupMade)).toBeTruthy()
  expect(sameCard(cardIn(folder), made(renameOnCard(card, 1, 'Boulder')).card)).toBe(true)
  expect(backupsIn(folder)).toHaveLength(1)

  fireEvent.click(main().getByRole('button', { name: strings.notice.undo }))
  expect(await main().findByText(text.saved.undone('Pebble'))).toBeTruthy()
  expect(main().getByRole('heading', { level: 1, name: text.title('Pebble') })).toBeTruthy()
  expect(sameCard(cardIn(folder), card)).toBe(true)
  expect(main().queryByRole('button', { name: strings.notice.undo })).toBeNull()
})

test('a name the radio cannot keep is refused with a message that says what to avoid, and nothing is saved', async () => {
  const folder = await connectedTo(madeUpCard(), { at: paths.editPart(pebble, 'name') })
  await main().findByLabelText(question)

  for (const refused of ['Café', 'Rock "n"', 'back\\slash', 'Truck 🚚']) {
    typeName(refused)
    expect(main().getByRole('alert').textContent, refused).toBe(strings.modelName.notPlain)
    save()
    expect(main().getByLabelText(question), refused).toBeTruthy()
  }
  expect(strings.modelName.notPlain).toMatch(/Avoid double quotes, backslashes, accented letters and emoji\.$/)
  // The other rules are the sample name page's own.
  typeName('Gravel Cat')
  expect(main().getByRole('alert').textContent).toBe(strings.modelName.alreadyUsed)
  typeName('   ')
  save()
  expect(main().getByRole('alert').textContent).toBe(strings.addModel.name.empty)

  expect(folder.log).toEqual([])
  expect(sameCard(cardIn(folder), madeUpCard())).toBe(true)
})

test('saving a name that has not changed just goes back to the model, and asks the folder for nothing', async () => {
  const folder = await connectedTo(madeUpCard(), { at: paths.editPart(pebble, 'name') })
  await main().findByLabelText(question)

  save()

  expect(await main().findByRole('link', { name: text.backToModels })).toBeTruthy()
  expect(main().queryByText(strings.notice.savedTitle)).toBeNull()
  expect(folder.log).toEqual([])
})

test('leaving the name page with a change not yet saved asks first', async () => {
  const folder = await connectedTo(madeUpCard(), { at: paths.editPart(pebble, 'name') })
  await main().findByLabelText(question)
  typeName('Boulder')

  fireEvent.click(main().getByRole('link', { name: text.cancel }))

  const dialog = within(await screen.findByRole('dialog'))
  expect(dialog.getByRole('heading', { name: text.leave.title })).toBeTruthy()
  expect(dialog.getByText(text.leave.body('Pebble'))).toBeTruthy()
  fireEvent.click(dialog.getByRole('button', { name: text.leave.leave }))

  expect(await main().findByRole('link', { name: text.backToModels })).toBeTruthy()
  expect(main().getByRole('heading', { level: 1, name: text.title('Pebble') })).toBeTruthy()
  expect(folder.log).toEqual([])
})

test('a model whose file could not be read has no Edit page: its address goes to the list', async () => {
  const card = new Map(madeUpCard()).set('MODELS/model01.yml', new TextEncoder().encode('not a model\n'))
  await connectedTo(card, { at: paths.editModel('place-2') })

  expect(await main().findByRole('heading', { level: 1, name: strings.models.title })).toBeTruthy()
})
