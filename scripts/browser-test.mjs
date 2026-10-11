// Runs the app's saving code, and the screens that use it, in a real browser on a made-up card.
//
//   npm run test:browser
//
// The unit tests give the saving code a folder that only exists in memory. This test gives it a
// real one: a folder in the browser's own private storage, which is the same kind of thing as a
// folder a person picks, except that no other site and no other program can see it. Nothing here
// touches a folder on disk, and the browser never has to ask whether files may be changed there.
//
// It has two halves.
//
// The saving code. The source is served with Vite, so the page can load the app's own modules.
// Then, for every action in src/files/cardActions.ts: it is carried out for real, the folder is
// read back, the action is undone, and the folder is read back again.
//
// The screens. The built site is served, and a made-up card is opened from the reviewer panel's
// own link. Every action is then done through the screens, once with the mouse and once with the
// keyboard alone: do it, read the files in the private storage, undo it, read them again. After
// that come the four ways a save can go wrong, and the sample models.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer, preview, runnerImport } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const problems = []
const checks = []
const check = (name, held, detail = '') => checks.push({ name, held: Boolean(held), detail: String(detail) })

/** Runs in the page. Gives back a list of checks, each with a name and whether it held. */
async function saveForReal() {
  const { cardSaver, BACKUPS_FOLDER } = await import('/src/platform/saveToFolder.ts')
  const { readRadioFolder } = await import('/src/platform/radioFolder.ts')
  const { modelPath, RADIO_SETTINGS_PATH } = await import('/src/files/card.ts')
  const actions = await import('/src/files/cardActions.ts')
  const { changesBetween, sameBytes } = await import('/src/files/changes.ts')
  const { privateFolderWith } = await import('/src/review/privateFolder.ts')

  const found = []
  const check = (name, held, detail = '') => found.push({ name, held: Boolean(held), detail: String(detail) })
  const sameCard = (first, second) =>
    first.size === second.size && [...first].every(([at, bytes]) => second.has(at) && sameBytes(second.get(at), bytes))
  const names = (card) => [...card.keys()].toSorted().join(' ')

  // The made-up card, written into the browser's private storage by the reviewer's own code.
  const folder = await privateFolderWith('madeUp')
  const readNow = async () => {
    const read = await readRadioFolder(folder)
    if (!read.ok) throw new Error(`the folder could not be read: ${read.problem}`)
    return read.card
  }
  /** Every file under a folder in the private storage, by its path from that folder. */
  async function everyFileIn(handle, prefix = '') {
    const files = new Map()
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'directory') for (const [at, bytes] of await everyFileIn(entry, `${prefix}${name}/`)) files.set(at, bytes)
      else files.set(`${prefix}${name}`, new Uint8Array(await (await entry.getFile()).arrayBuffer()))
    }
    return files
  }
  const backupFolders = async () => {
    const found = []
    try {
      for await (const [name, entry] of (await folder.getDirectoryHandle(BACKUPS_FOLDER)).entries()) {
        if (entry.kind === 'directory') found.push(name)
      }
    } catch {
      // No backups folder yet.
    }
    return found.toSorted()
  }

  const original = await readNow()
  check('the made-up card is in the private storage', original.size === 8, names(original))
  check('the browser lets the page change files there', (await folder.requestPermission({ mode: 'readwrite' })) === 'granted')
  check('there is no backup before the first save', (await backupFolders()).length === 0)

  const saver = cardSaver(folder)

  /** Carries an action out for real, reads it back, undoes it, and reads that back. */
  async function doAndUndo(name, act) {
    const before = await readNow()
    const action = act(before)
    if (!action.ok) return check(`${name}: the card logic allows it`, false, action.problem)

    const saved = await saver.save(before, action.changes)
    if (!saved.ok) return check(`${name}: saved`, false, JSON.stringify(saved))
    const after = await readNow()
    check(`${name}: the folder holds the new card`, sameCard(after, action.card), names(after))
    check(`${name}: the saver gives back what is in the folder`, sameCard(saved.card, after))
    check(`${name}: it changed something`, !sameCard(after, before))

    const undone = await saver.save(after, changesBetween(after, before))
    if (!undone.ok) return check(`${name}: undone`, false, JSON.stringify(undone))
    check(`${name}: undone, the folder is byte for byte as it was`, sameCard(await readNow(), before))
    return action
  }

  await doAndUndo('rename', (card) => actions.renameOnCard(card, 1, 'Boulder'))
  await doAndUndo('copy', (card) => actions.copyOnCard(card, 3, 'Newt'))
  await doAndUndo('delete, leaving the place empty', (card) => actions.deleteFromCard(card, 2, { closeUp: false }))
  await doAndUndo('delete, closing up', (card) => actions.deleteFromCard(card, 2, { closeUp: true }))
  await doAndUndo('delete the model the radio is set to', (card) => actions.deleteFromCard(card, 5, { closeUp: true, switchTo: 1 }))
  await doAndUndo('move a model', (card) => actions.moveOnCard(card, 3, 5))
  await doAndUndo('move two models round a full circle', (card) => actions.moveOnCard(card, 1, 2))
  await doAndUndo('move an empty place', (card) => actions.moveOnCard(card, 4, 1))
  await doAndUndo('close up empty places', (card) => actions.closeUpOnCard(card))

  // Restore needs a deleted model to bring back. The delete is saved first and undone last.
  {
    const before = await readNow()
    const gone = actions.deleteFromCard(before, 3, { closeUp: true })
    const saved = gone.ok ? await saver.save(before, gone.changes) : { ok: false }
    check('a delete to restore from: saved', saved.ok, JSON.stringify(saved.ok ? '' : saved))
    if (gone.ok && saved.ok) {
      await doAndUndo('restore', (card) => actions.restoreOnCard(card, gone.deletedPath))
      const deleted = await readNow()
      const back = await saver.save(deleted, changesBetween(deleted, before))
      check('the delete is undone as well', back.ok && sameCard(await readNow(), before))
    }
  }

  check('after every action and its undo, the card is as it started', sameCard(await readNow(), original), names(await readNow()))

  // One backup for all of that, made before the first change, and it is the card as it started.
  const backups = await backupFolders()
  check('one backup was made for the whole run', backups.length === 1, backups.join(' '))
  if (backups.length === 1) {
    const backup = await everyFileIn(await (await folder.getDirectoryHandle(BACKUPS_FOLDER)).getDirectoryHandle(backups[0]))
    const expected = new Map([...original].filter(([at]) => /^MODELS\/model\d\d\.yml$/.test(at) || at === RADIO_SETTINGS_PATH))
    check('the backup holds the models and the settings as they started, byte for byte', sameCard(backup, expected), names(backup))
  }

  // Something else changes a file. The saver sees it and changes nothing.
  {
    const held = await readNow()
    const models = await folder.getDirectoryHandle('MODELS')
    const writing = await (await models.getFileHandle('model00.yml')).createWritable()
    await writing.write(new TextEncoder().encode('changed by something else\r\n'))
    await writing.close()
    const changedUnderneath = await readNow()
    const rename = actions.renameOnCard(held, 1, 'Boulder')
    const result = await saver.save(held, rename.changes)
    check('a card changed underneath is reported', !result.ok && result.problem === 'cardChanged', JSON.stringify(result))
    check('and nothing on it is changed', sameCard(await readNow(), changedUnderneath))
    // Put the file back the way the made-up card has it.
    const restoring = await (await models.getFileHandle('model00.yml')).createWritable()
    await restoring.write(held.get(modelPath(1)))
    await restoring.close()
    check('the card is as it started again', sameCard(await readNow(), original))
  }

  // A second Connect to the same folder makes a second backup, named to sort after the first.
  {
    const again = cardSaver(folder)
    const before = await readNow()
    const rename = actions.renameOnCard(before, 1, 'Boulder')
    const saved = await again.save(before, rename.changes)
    const both = await backupFolders()
    check('a second Connect makes a second backup', saved.ok && both.length === 2 && saved.backup === both[1], both.join(' '))
    check('the first backup is still there, and sorts first', both[0] === backups[0])
    const after = await readNow()
    const undone = await again.save(after, changesBetween(after, before))
    check('and its change is undone too', undone.ok && sameCard(await readNow(), original))
  }

  return found
}

// ---------------------------------------------------------------------------------------------
// The screens
// ---------------------------------------------------------------------------------------------

const load = async (file) => (await runnerImport(file, { root, configFile: false, logLevel: 'silent' })).module

/** The made-up card as it is on disk in the repo, which is what the reviewer's link puts in private storage. */
function madeUpCardOnDisk() {
  const card = new Map()
  const top = path.join(root, 'src/files/testdata/card')
  for (const folder of ['MODELS', 'RADIO']) {
    for (const name of readdirSync(path.join(top, folder))) card.set(`${folder}/${name}`, new Uint8Array(readFileSync(path.join(top, folder, name))))
  }
  return card
}

/** Runs in the page: every file of a made-up card in private storage, as [path, bytes] pairs. */
async function readPrivateCard(folderName) {
  const top = await (await navigator.storage.getDirectory()).getDirectoryHandle(folderName)
  const files = []
  async function walk(folder, prefix) {
    for await (const [name, entry] of folder.entries()) {
      if (entry.kind === 'directory') await walk(entry, `${prefix}${name}/`)
      else files.push([`${prefix}${name}`, [...new Uint8Array(await (await entry.getFile()).arrayBuffer())]])
    }
  }
  await walk(top, '')
  return files
}

async function screens(browser, baseUrl) {
  const actions = await load('/src/files/cardActions.ts')
  const { applyChanges, sameBytes } = await load('/src/files/changes.ts')
  const { strings } = await load('/src/strings/en.ts')
  const say = strings.models
  const notice = strings.notice

  const sameCard = (first, second) =>
    first.size === second.size && [...first].every(([at, bytes]) => second.has(at) && sameBytes(second.get(at), bytes))
  const made = (result) => {
    if (!result.ok) throw new Error(`the card logic refused: ${result.problem}`)
    return result
  }
  const original = madeUpCardOnDisk()

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`the page threw an error: ${error.message}`))
  page.on('console', (message) => {
    // A save that is made to fail by the reviewer's switch says so in the console. That is meant.
    if (message.type() === 'error' && !message.text().includes('reviewer')) problems.push(`the page logged an error: ${message.text()}`)
  })
  const main = page.locator('main')

  /** The files in private storage: the card itself, and the names of the backup folders. */
  async function inStorage() {
    const files = new Map((await page.evaluate(readPrivateCard, 'review-card-madeUp')).map(([at, bytes]) => [at, new Uint8Array(bytes)]))
    const card = new Map([...files].filter(([at]) => !at.startsWith('APP-BACKUPS/')))
    const backups = new Set([...files.keys()].flatMap((at) => /^APP-BACKUPS\/([^/]+)\//.exec(at)?.[1] ?? []))
    return { card, backups: [...backups].toSorted() }
  }
  const settle = async () => {
    await main.waitFor()
    await page.waitForFunction(() => !document.querySelector('[data-opening-card]'))
  }
  /** Opens a state from its own link in the reviewer panel, as a reviewer would. */
  async function open(stateId) {
    await page.goto('about:blank')
    await page.goto(baseUrl)
    await settle()
    await page.locator('details > summary').click()
    await page.locator(`a[data-review-state="${stateId}"]`).click()
    await page.waitForURL((url) => url.search.includes(`state=${stateId}`))
    await settle()
  }
  const savedNotice = (words) => main.getByText(words, { exact: true }).waitFor()

  // How each thing is done with the mouse, and with the keyboard alone.
  const mouse = {
    name: 'mouse',
    press: (locator) => locator.click(),
    type: (locator, words) => locator.fill(words),
    choose: (locator, value) => locator.selectOption(value),
    pick: (radio) => radio.check(),
  }
  /** Presses Tab until the keyboard focus is on this one thing. Everything has to be reachable that way. */
  async function tabTo(locator) {
    const target = await locator.elementHandle()
    for (let presses = 0; presses < 400; presses += 1) {
      if (await target.evaluate((element) => element === document.activeElement)) return
      await page.keyboard.press('Tab')
    }
    throw new Error(`Tab never reached ${await target.evaluate((element) => element.outerHTML.slice(0, 80))}`)
  }
  const keyboard = {
    name: 'keyboard',
    press: async (locator) => {
      await tabTo(locator)
      await page.keyboard.press('Enter')
    },
    type: async (locator, words) => {
      await tabTo(locator)
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.type(words)
    },
    // A list of choices is worked with the arrow keys, one step at a time, from wherever it stands.
    choose: async (locator, value) => {
      await tabTo(locator)
      const steps = await locator.evaluate((select, wanted) => {
        const values = [...select.options].map((option) => option.value)
        return values.indexOf(wanted) - select.selectedIndex
      }, value)
      for (let step = 0; step < Math.abs(steps); step += 1) await page.keyboard.press(steps > 0 ? 'ArrowDown' : 'ArrowUp')
    },
    // Tab stops on a group of choices once, at the one that is chosen. The arrow keys move within it.
    pick: async (radio) => {
      const group = page.locator(`input[type="radio"][name="${await radio.getAttribute('name')}"]`)
      const chosen = group.and(page.locator(':checked'))
      await tabTo((await chosen.count()) > 0 ? chosen : group.first())
      for (let presses = 0; presses < 10 && !(await radio.isChecked()); presses += 1) await page.keyboard.press('ArrowDown')
    },
  }

  const button = (name) => main.getByRole('button', { name, exact: true })
  const dialog = () => page.locator('dialog[open]')

  for (const by of [mouse, keyboard]) {
    const tag = (name) => `by ${by.name}: ${name}`
    await open('card-made-up')
    await main.locator('ol').first().waitFor()
    check(tag('the made-up card is in private storage as it is in the repo'), sameCard((await inStorage()).card, original))
    let backupsSoFar = 0

    /**
     * Does one thing through the screens, checks the files, undoes it, and checks them again.
     * `expected` is the card the card logic says should result. `words` is the confirmation to wait for.
     */
    async function doAndUndo(name, act, expected, words, undoneWords = notice.undone) {
      const before = (await inStorage()).card
      await act()
      await savedNotice(words)
      const after = await inStorage()
      check(tag(`${name}: the files in private storage are the new card`), sameCard(after.card, expected), [...after.card.keys()].join(' '))
      // The first change after the card was opened makes the one backup. No later one adds to it.
      if (backupsSoFar === 0) check(tag(`${name}: the first change made one backup, and the notice says so`), after.backups.length === 1 && (await main.getByText(strings.card.backupMade).count()) === 1)
      else check(tag(`${name}: no second backup`), after.backups.length === backupsSoFar && (await main.getByText(strings.card.backupMade).count()) === 0)
      backupsSoFar = after.backups.length

      await by.press(button(notice.undo))
      await savedNotice(undoneWords)
      check(tag(`${name}: undone, the files are byte for byte as they were`), sameCard((await inStorage()).card, before))
      check(tag(`${name}: Undo is not offered a second time`), (await button(notice.undo).count()) === 0)
    }

    // Copy
    await doAndUndo(
      'copy',
      async () => {
        await by.press(button(say.copyNamed('Gravel Cat')))
        await by.type(dialog().getByLabel(strings.copy.nameLabel), 'Shingle')
        await by.press(dialog().getByRole('button', { name: strings.copy.confirm }))
      },
      made(actions.copyOnCard(original, 2, 'Shingle')).card,
      notice.added('Shingle', 4),
    )

    // Move, through the dialog. The radio's model is one of those that moves.
    await doAndUndo(
      'move',
      async () => {
        await by.press(button(say.moveNamed('Mudskipper')))
        await by.choose(dialog().getByLabel(strings.moveModel.positionLabel), '5')
        await by.press(dialog().getByRole('button', { name: strings.moveModel.confirm }))
      },
      made(actions.moveOnCard(original, 3, 5)).card,
      notice.moved('Mudskipper', 5),
      notice.restored('Mudskipper', 3),
    )

    // Move an empty place.
    await doAndUndo(
      'move an empty place',
      async () => {
        await by.press(button(say.moveEmptyNamed(4)))
        await by.choose(dialog().getByLabel(strings.moveModel.positionLabel), '1')
        await by.press(dialog().getByRole('button', { name: strings.moveModel.confirmEmpty }))
      },
      made(actions.moveOnCard(original, 4, 1)).card,
      notice.emptyMoved(4, 1),
    )

    // Dragging a row is a thing of the mouse. The Move dialog is how it is done from the keyboard.
    if (by === mouse) {
      await doAndUndo(
        'drag a row',
        async () => {
          const rows = main.locator('ol').first().locator('> li')
          const from = await rows.nth(0).locator('[draggable="true"]').boundingBox()
          const to = await rows.nth(2).boundingBox()
          await page.mouse.move(from.x + 8, from.y + from.height / 2)
          await page.mouse.down()
          await page.mouse.move(from.x + 12, from.y + from.height / 2 + 8, { steps: 4 })
          await page.mouse.move(to.x + 200, to.y + to.height / 2, { steps: 12 })
          await page.mouse.up()
        },
        made(actions.moveOnCard(original, 1, 3)).card,
        notice.moved('Pebble', 3),
        notice.restored('Pebble', 1),
      )
    }

    // Close up empty places
    await doAndUndo(
      'close up empty places',
      () => by.press(button(say.closeUp)),
      made(actions.closeUpOnCard(original)).card,
      notice.closedUp(5),
    )

    // Delete, with the list closing up
    await doAndUndo(
      'delete',
      async () => {
        await by.press(button(say.deleteNamed('Gravel Cat')))
        await by.press(dialog().getByRole('button', { name: strings.deleteModel.confirm }))
      },
      made(actions.deleteFromCard(original, 2, { closeUp: true })).card,
      [notice.deleted('Gravel Cat'), notice.othersAfterMovedUp(3), notice.copyKept].join(' '),
      notice.restored('Gravel Cat', 2),
    )

    // Delete the model the radio is set to, after saying which model to switch to
    await doAndUndo(
      'delete the model the radio is set to',
      async () => {
        await by.press(button(say.deleteNamed('Tin Snail')))
        await by.choose(dialog().getByLabel(strings.deleteModel.switchLabel), '1')
        await by.press(dialog().getByRole('button', { name: strings.deleteModel.confirm }))
      },
      made(actions.deleteFromCard(original, 5, { closeUp: true, switchTo: 1 })).card,
      [notice.deleted('Tin Snail'), notice.oneMoved('Bog Hopper', 'up'), notice.copyKept].join(' '),
      notice.restored('Tin Snail', 5),
    )

    // Rename, from the row's Edit link, through the short Edit page and the name page
    {
      const before = (await inStorage()).card
      await by.press(main.locator('ol').first().getByRole('link', { name: say.editNamed('Pebble'), exact: true }))
      await main.getByRole('heading', { level: 1, name: strings.editModel.title('Pebble') }).waitFor()
      check(tag('rename: Edit opens the short page'), (await main.locator('dl > div').count()) === 3 && (await main.getByText(strings.card.restOfModel).count()) === 1)
      await by.press(main.getByRole('link', { name: strings.addModel.review.changeNamed(strings.addModel.review.rows.name) }))
      const field = main.getByLabel(strings.addModel.name.question)
      await field.waitFor()
      await by.type(field, 'Boulder')
      await by.press(main.getByRole('button', { name: strings.editModel.save }))
      await savedNotice(strings.editModel.saved.renamed('Pebble', 'Boulder'))
      const after = await inStorage()
      check(tag('rename: the files in private storage are the new card'), sameCard(after.card, made(actions.renameOnCard(original, 1, 'Boulder')).card))
      check(tag('rename: no second backup'), after.backups.length === backupsSoFar)
      await by.press(button(notice.undo))
      await savedNotice(strings.editModel.saved.undone('Pebble'))
      check(tag('rename: undone, the files are byte for byte as they were'), sameCard((await inStorage()).card, before))
      await by.press(main.getByRole('link', { name: strings.editModel.backToModels }))
      await main.locator('ol').first().waitFor()
    }

    // Delete with "leave its place empty" chosen in Radio setup, then Restore from "Recently deleted"
    {
      await by.press(page.getByRole('link', { name: strings.header.radioSetup }))
      await by.pick(main.getByLabel(new RegExp(strings.radioSetup.whenDeleting.options.leaveEmpty.label)))
      await by.press(main.getByRole('button', { name: strings.radioSetup.save, exact: true }))
      await main.locator('ol').first().waitFor()

      const left = made(actions.deleteFromCard(original, 2, { closeUp: false }))
      await by.press(button(say.deleteNamed('Gravel Cat')))
      await by.press(dialog().getByRole('button', { name: strings.deleteModel.confirm }))
      await savedNotice([notice.deleted('Gravel Cat'), notice.leftEmpty(2), notice.copyKept].join(' '))
      check(tag('delete, leaving the place empty: the files are the new card'), sameCard((await inStorage()).card, left.card))

      // The model is now under "Recently deleted", read from MODELS/DELETED on the card.
      const restore = page.getByRole('button', { name: strings.recentlyDeleted.restoreNamed('Gravel Cat') })
      await by.press(restore)
      await savedNotice(notice.restored('Gravel Cat', 2))
      check(tag('restore: the files are the card as it started'), sameCard((await inStorage()).card, original))
      await by.press(button(notice.undo))
      await savedNotice(notice.undone)
      check(tag('restore: undone, the model is deleted again'), sameCard((await inStorage()).card, left.card))
      await by.press(page.getByRole('button', { name: strings.recentlyDeleted.restoreNamed('Gravel Cat') }))
      await savedNotice(notice.restored('Gravel Cat', 2))
      check(tag('after everything, the card is byte for byte as it started'), sameCard((await inStorage()).card, original))
      check(tag('one backup for the whole run'), (await inStorage()).backups.length === 1)
    }
  }

  // While a save runs, nothing else can be clicked or reached.
  {
    await open('change-saving')
    await page.getByRole('dialog', { name: strings.card.saving }).waitFor()
    const copy = button(say.copyNamed('Pebble'))
    const box = await copy.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    for (let presses = 0; presses < 6; presses += 1) await page.keyboard.press('Tab')
    const state = await page.evaluate(() => ({
      dialogs: document.querySelectorAll('dialog[open]').length,
      focusInside: document.activeElement?.closest('dialog[open]') !== null || document.activeElement === document.body,
    }))
    check('while saving: a click, Escape twice and Tab reach nothing behind "Saving…"', state.dialogs === 1 && state.focusInside && (await page.getByRole('dialog', { name: strings.card.saving }).isVisible()), JSON.stringify(state))
  }

  // The four ways a save can go wrong, by the reviewer's switch on a card that is already open.
  const trouble = strings.card.trouble
  const ways = [
    ['notAllowed', trouble.nothingChanged, trouble.notAllowed, trouble.ok],
    ['cardChanged', trouble.nothingChanged, trouble.cardChanged, trouble.readAgain],
    ['backupFailed', trouble.nothingChanged, trouble.backupFailed, trouble.ok],
    ['stopsPartWay', trouble.didNotFinishTitle, trouble.didNotFinish, trouble.readAgain],
  ]
  for (const [way, title, body, pressed] of ways) {
    await open('card-made-up')
    await main.locator('ol').first().waitFor()
    await page.locator('details > summary').click()
    await page.getByLabel(strings.review.nextSave.ways[way], { exact: true }).check()
    await page.locator('details > summary').click()
    const shown = await main.locator('ol').first().innerText()

    // A move is several changes, so it is the one that can stop part way.
    const move = made(actions.moveOnCard(original, 3, 5))
    await button(say.moveNamed('Mudskipper')).click()
    await dialog().getByLabel(strings.moveModel.positionLabel).selectOption('5')
    await dialog().getByRole('button', { name: strings.moveModel.confirm }).click()
    await dialog().getByRole('heading', { name: title }).waitFor()

    check(`${way}: the message says what happened and what to do`, (await dialog().getByText(body, { exact: true }).count()) === 1 && (await dialog().getByRole('button').allInnerTexts()).join('|') === pressed)
    check(`${way}: the list behind is as it was`, (await main.locator('ol').first().innerText()) === shown && (await main.getByText(notice.savedTitle).count()) === 0)

    const stored = (await inStorage()).card
    if (way === 'stopsPartWay') {
      check(`${way}: the card holds the first change and no more, and no model is lost`, sameCard(stored, applyChanges(original, move.changes.slice(0, 1))))
    } else if (way === 'cardChanged') {
      const settings = 'RADIO/radio.yml'
      const rest = (card) => new Map([...card].filter(([at]) => at !== settings))
      check(`${way}: only what the something else changed is different`, sameCard(rest(stored), rest(original)) && !sameBytes(stored.get(settings), original.get(settings)))
    } else {
      check(`${way}: nothing on the card is changed`, sameCard(stored, original))
    }

    await dialog().getByRole('button', { name: pressed }).click()
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    if (pressed === trouble.readAgain) {
      const now = await main.locator('ol').first().innerText()
      check(`${way}: "Read the card again" shows what is on the card now`, way === 'stopsPartWay' ? now !== shown && now.split('Tin Snail').length === 3 : (await main.getByText(say.currentStrip('Pebble', 1)).count()) === 1, now.replaceAll('\n', ' '))
    }
    // The switch is used up, so the same change now goes through.
    if (way !== 'stopsPartWay') {
      await button(say.moveNamed('Mudskipper')).click()
      await dialog().getByLabel(strings.moveModel.positionLabel).selectOption('5')
      await dialog().getByRole('button', { name: strings.moveModel.confirm }).click()
      await savedNotice(notice.moved('Mudskipper', 5))
      check(`${way}: the next save works`, true)
    }
  }

  // Sample models still work from their link, and nothing of theirs goes near the private storage.
  {
    await open('card-connect-page')
    await main.getByRole('link', { name: strings.connect.sampleLink }).click()
    await main.getByText(strings.baseFitting.options.blankCover.label, { exact: true }).click()
    await main.getByRole('button', { name: strings.connect.connected.continue }).click()
    await main.locator('ol').first().waitFor()
    const header = await page.locator('header p').innerText()
    const list = {
      rows: await main.locator('ol').first().locator('> li').count(),
      add: await main.getByRole('link', { name: say.addModel }).count(),
      hint: await main.getByText(say.reorderHint).count(),
      comingNext: await main.getByText(strings.card.comingNext).count(),
    }
    check('sample models: the list is the sample list, with its Add button and its hint', header === strings.header.sample(20, 60) && list.rows === 20 && list.add === 1 && list.hint === 1 && list.comingNext === 0, `${header} ${JSON.stringify(list)}`)
    await main.locator('ol').first().locator('> li').first().getByRole('button', { name: say.copy }).click()
    await dialog().getByLabel(strings.copy.nameLabel).fill('Café')
    await dialog().getByRole('button', { name: strings.copy.confirm }).click()
    await savedNotice(notice.added('Café', 21))
    check('sample models: a copy is made at once, with any name, and with no Undo', (await button(notice.undo).count()) === 0 && (await page.locator('header p').innerText()) === strings.header.sample(21, 60))
    await main.getByRole('link', { name: say.addModel }).first().click()
    await page.locator('[aria-current="step"]').waitFor()
    check('sample models: "Add a model" opens the wizard', new URL(page.url()).hash.startsWith('#/models/add/'))
  }

  await context.close()
}

// ---------------------------------------------------------------------------------------------

const browser = await chromium.launch()

// The saving code, served from the source.
const source = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 4174 } })
await source.listen()
try {
  const page = await browser.newPage()
  page.on('pageerror', (error) => problems.push(`the page threw an error: ${error.message}`))
  await page.goto(source.resolvedUrls.local[0])
  await page.locator('main').waitFor()
  for (const { name, held, detail } of await page.evaluate(saveForReal)) check(`the saving code: ${name}`, held, detail)
  await page.close()
} catch (error) {
  problems.push(`the saving code: ${error.message}`)
} finally {
  await source.close()
}

// The screens, served as built.
const built = await preview({ root, logLevel: 'silent', preview: { host: '127.0.0.1', port: 4175 } })
try {
  await screens(browser, built.resolvedUrls.local[0])
} catch (error) {
  problems.push(`the screens: ${error.message.split('\n')[0]}`)
} finally {
  await browser.close()
  await built.close()
}

for (const { name, held, detail } of checks) {
  console.log(`${held ? 'ok  ' : 'FAIL'}  ${name}${held || !detail ? '' : `  [${detail}]`}`)
  if (!held) problems.push(name)
}
if (checks.length === 0) problems.push('no checks ran')

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} checks held, in a real browser, on made-up cards in its private storage.`)
