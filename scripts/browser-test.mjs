// Runs the app's saving code in a real browser, against a made-up card.
//
//   npm run test:browser
//
// The unit tests give the saving code a folder that only exists in memory. This test gives it a
// real one: a folder in the browser's own private storage, which is the same kind of thing as a
// folder a person picks, except that no other site and no other program can see it. Nothing here
// touches a folder on disk.
//
// It serves the source with Vite, so the page can load the app's own modules, and then, for every
// action in src/files/cardActions.ts: carries it out for real, reads the folder back, undoes it,
// and reads the folder back again.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Runs in the page. Gives back a list of checks, each with a name and whether it held. */
async function saveForReal() {
  const { cardSaver, BACKUPS_FOLDER } = await import('/src/platform/saveToFolder.ts')
  const { readRadioFolder } = await import('/src/platform/radioFolder.ts')
  const { modelPath, RADIO_SETTINGS_PATH } = await import('/src/files/card.ts')
  const actions = await import('/src/files/cardActions.ts')
  const { changesBetween, sameBytes } = await import('/src/files/changes.ts')
  const { privateFolderWith } = await import('/src/review/privateFolder.ts')

  const checks = []
  const check = (name, held, detail = '') => checks.push({ name, held: Boolean(held), detail: String(detail) })
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

  return checks
}

const server = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 4174 } })
await server.listen()
const browser = await chromium.launch()
const problems = []
let checks = []

try {
  const page = await browser.newPage()
  page.on('pageerror', (error) => problems.push(`the page threw an error: ${error.message}`))
  await page.goto(server.resolvedUrls.local[0])
  await page.locator('main').waitFor()
  checks = await page.evaluate(saveForReal)
} finally {
  await browser.close()
  await server.close()
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
console.log(`\nAll ${checks.length} checks held, in a real browser, on a made-up card in its private storage.`)
