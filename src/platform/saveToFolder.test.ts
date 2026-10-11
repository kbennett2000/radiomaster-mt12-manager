/// <reference types="node" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { modelPath, RADIO_SETTINGS_PATH, readCard, type Card } from '../files/card.ts'
import {
  closeUpOnCard,
  copyOnCard,
  deleteFromCard,
  moveOnCard,
  renameOnCard,
  restoreOnCard,
  type CardResult,
} from '../files/cardActions.ts'
import { applyChanges, changesBetween, sameBytes, type Change } from '../files/changes.ts'
import { bytesFromText } from '../files/document.ts'
import { cardFromFolder } from '../test/cardFromFolder.ts'
import { folderHolding, type MadeUpFolder } from '../test/folderHolding.ts'
import { backupName, cardSaver, type CardSaver, type SaveResult } from './saveToFolder.ts'

// The made-up card: five invented models in positions 1, 2, 3, 5 and 6, the radio set to the one
// in position 5, and one other file in each folder. Every folder in these tests is kept in memory.
const testdata = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'files', 'testdata', 'card')
const madeUp = (): Card => cardFromFolder(testdata, ['MODELS', 'RADIO'])

const WHEN = new Date(2026, 9, 11, 14, 3, 27)
const BACKUP = 'APP-BACKUPS/2026-10-11_14-03-27'
const saverFor = (made: MadeUpFolder, when: () => Date = () => WHEN): CardSaver => cardSaver(made.folder, when)

const sameCard = (first: Card, second: Card): boolean =>
  first.size === second.size && [...first].every(([at, bytes]) => second.has(at) && sameBytes(second.get(at)!, bytes))
/** The files of the card itself in a made-up folder, leaving out the backups. */
const cardIn = (made: MadeUpFolder): Card => new Map([...made.files()].filter(([at]) => !at.startsWith('APP-BACKUPS/')))
const backupsIn = (made: MadeUpFolder): string[] => made.folders().filter((at) => /^APP-BACKUPS\/[^/]+\/$/.test(at))
const listed = (changes: readonly Change[]): string[] => changes.map((change) => `${change.kind} ${change.path}`)
/** What was done to the card itself, leaving out the asking and the backup. */
const doneToCard = (made: MadeUpFolder): string[] => made.log.filter((entry) => entry !== 'ask' && !entry.includes('APP-BACKUPS/'))
const text = (words: string): Uint8Array => bytesFromText(words)

function made<Also>(result: CardResult<Also>): Extract<CardResult<Also>, { ok: true }> {
  if (!result.ok) throw new Error(`refused: ${result.problem}`)
  return result
}
function saved(result: SaveResult): Extract<SaveResult, { ok: true }> {
  if (!result.ok) throw new Error(`not saved: ${result.problem}`)
  return result
}

test('the browser\'s own folder handle is one the saver takes', () => {
  // This is for the type checker: it fails to build if a real handle lacks anything the saver uses.
  const forRealHandle: (handle: FileSystemDirectoryHandle) => CardSaver = cardSaver
  expect(forRealHandle).toBe(cardSaver)
})

// 1. Permission

test('the browser is asked before anything is read or written, and "granted" lets the save go on', async () => {
  const card = madeUp()
  const folder = folderHolding(card)
  const rename = made(renameOnCard(card, 1, 'Boulder'))

  const result = saved(await saverFor(folder).save(card, rename.changes))

  expect(folder.log[0]).toBe('ask')
  expect(folder.log.filter((entry) => entry === 'ask')).toHaveLength(1)
  expect(sameCard(result.card, rename.card)).toBe(true)
})

test.each(['denied', 'prompt', 'error'] as const)('when the browser answers "%s", nothing is changed', async (answer) => {
  const card = madeUp()
  const folder = folderHolding(card)
  folder.permission = answer

  const result = await saverFor(folder).save(card, made(renameOnCard(card, 1, 'Boulder')).changes)

  expect(result).toEqual({ ok: false, problem: 'notAllowed' })
  // It asked, and then did nothing at all: no file was read, none written, and no backup made.
  expect(folder.log).toEqual(['ask'])
  expect(folder.opened).toEqual([])
  expect(sameCard(folder.files(), card)).toBe(true)
})

// 2. The card must be what the app thinks it is

test('a card that has changed underneath is not touched', async () => {
  const card = madeUp()
  const changed = { ok: false, problem: 'cardChanged' }

  async function saveOnto(folder: MadeUpFolder, changes: readonly Change[]) {
    const before = folder.files()
    const result = await saverFor(folder).save(card, changes)
    expect(folder.log, 'nothing but the asking').toEqual(['ask'])
    expect(sameCard(folder.files(), before), 'no file changed').toBe(true)
    expect(folder.folders().some((at) => at.startsWith('APP-BACKUPS')), 'no backup').toBe(false)
    return result
  }

  // A file the changes are going to write over is not what the app holds.
  const rename = made(renameOnCard(card, 1, 'Boulder')).changes
  const editedElsewhere = folderHolding(new Map(card).set(modelPath(1), text('changed by something else\r\n')))
  expect(await saveOnto(editedElsewhere, rename)).toEqual(changed)

  // The settings are not what the app holds, though this change would not touch them.
  const settingsChanged = folderHolding(new Map(card).set(RADIO_SETTINGS_PATH, text('changed by something else\r\n')))
  expect(await saveOnto(settingsChanged, rename)).toEqual(changed)

  // A file is where the app holds none: the place a copy would go to has been taken.
  const copy = made(copyOnCard(card, 3, 'Newt')).changes
  expect(listed(copy)).toEqual(['write MODELS/model03.yml'])
  const placeTaken = folderHolding(new Map(card).set(modelPath(4), card.get(modelPath(1))!))
  expect(await saveOnto(placeTaken, copy)).toEqual(changed)

  // A file the changes are going to remove is already gone.
  const move = made(moveOnCard(card, 3, 5)).changes
  expect(listed(move)).toContain('remove MODELS/model02.yml')
  const alreadyGone = folderHolding(new Map([...card].filter(([at]) => at !== modelPath(3))))
  expect(await saveOnto(alreadyGone, move)).toEqual(changed)

  // A file that cannot be read is not one the app can vouch for.
  expect(await saveOnto(folderHolding(card, [modelPath(1)]), rename)).toEqual(changed)
})

test('a change elsewhere on the card does not stop a save, and comes back in the card that is given back', async () => {
  const card = madeUp()
  const elsewhere = text('changed by something else\r\n')
  const folder = folderHolding(new Map(card).set(modelPath(6), elsewhere))
  const rename = made(renameOnCard(card, 1, 'Boulder'))

  const result = saved(await saverFor(folder).save(card, rename.changes))

  // The app is told what is really there, not what it worked out.
  expect(sameBytes(result.card.get(modelPath(6))!, elsewhere)).toBe(true)
  expect(sameBytes(result.card.get(modelPath(1))!, rename.card.get(modelPath(1))!)).toBe(true)
  expect(result.reading).toEqual(readCard(result.card))
})

// 3. A backup before the first change

test('the first save copies every model, every deleted model and the settings, and checks the copy', async () => {
  const start = madeUp()
  // A card with a deleted model on it already, so there is one to back up.
  const card = made(deleteFromCard(start, 2, { closeUp: false })).card
  const folder = folderHolding(card)
  const rename = made(renameOnCard(card, 1, 'Boulder'))

  const result = saved(await saverFor(folder).save(card, rename.changes))

  expect(result.backup).toBe('2026-10-11_14-03-27')
  const backedUp = [...folder.files()].filter(([at]) => at.startsWith(`${BACKUP}/`))
  expect(backedUp.map(([at]) => at.slice(BACKUP.length + 1)).toSorted()).toEqual([
    'MODELS/DELETED/0001-model01.yml',
    'MODELS/model00.yml',
    'MODELS/model02.yml',
    'MODELS/model04.yml',
    'MODELS/model05.yml',
    'RADIO/radio.yml',
  ])
  // Byte for byte as the card was before the change, the renamed model included.
  for (const [at, bytes] of backedUp) expect(sameBytes(bytes, card.get(at.slice(BACKUP.length + 1))!), at).toBe(true)

  // The whole backup is written, and read back, before the card is touched.
  const firstChange = folder.log.indexOf('write MODELS/model00.yml')
  const backupWrites = folder.log.flatMap((entry, index) => (entry.startsWith('write APP-BACKUPS/') ? [index] : []))
  expect(backupWrites).toHaveLength(6)
  expect(Math.max(...backupWrites)).toBeLessThan(firstChange)
  const readBack = folder.opened.filter((at) => at.startsWith(`${BACKUP}/`))
  expect(readBack.toSorted()).toEqual(backedUp.map(([at]) => at).toSorted())
})

test('there is one backup for a Connect, however many saves follow, until the saver starts afresh', async () => {
  let card = madeUp()
  const folder = folderHolding(card)
  const times = [WHEN, new Date(2026, 9, 11, 15, 0, 0)]
  const saver = saverFor(folder, () => times[0])

  const first = saved(await saver.save(card, made(renameOnCard(card, 1, 'Boulder')).changes))
  card = first.card
  const second = saved(await saver.save(card, made(moveOnCard(card, 1, 4)).changes))
  card = second.card
  const third = saved(await saver.save(card, made(deleteFromCard(card, 2, { closeUp: true })).changes))
  card = third.card

  expect([first.backup, second.backup, third.backup]).toEqual(['2026-10-11_14-03-27', null, null])
  expect(backupsIn(folder)).toEqual([`${BACKUP}/`])
  // The one backup is of the card before the first change.
  expect(new TextDecoder().decode(folder.files().get(`${BACKUP}/MODELS/model00.yml`))).toContain('"Pebble"')

  // Reading the card again counts as a new start, so the next change is backed up first.
  saver.startAfresh()
  times.shift()
  const fourth = saved(await saver.save(card, made(renameOnCard(card, 1, 'Cairn')).changes))
  expect(fourth.backup).toBe('2026-10-11_15-00-00')
  expect(backupsIn(folder)).toHaveLength(2)
})

test('when the backup cannot be made, or does not match, nothing on the card is changed', async () => {
  const card = madeUp()
  const failed = { ok: false, problem: 'backupFailed' }
  const rename = made(renameOnCard(card, 1, 'Boulder')).changes

  async function saveWith(arrange: (folder: MadeUpFolder) => void) {
    const folder = folderHolding(card)
    arrange(folder)
    const result = await saverFor(folder).save(card, rename)
    expect(sameCard(cardIn(folder), card), 'the card is untouched').toBe(true)
    expect(doneToCard(folder), 'nothing was done to the card').toEqual([])
    // A backup that failed part way is taken away again, so it is never mistaken for a good one.
    expect(backupsIn(folder), 'no half-made backup is left').toEqual([])
    return result
  }

  // The backups folder cannot be made at all.
  expect(await saveWith((folder) => (folder.fails = ({ kind, path: at }) => kind === 'make' && at === 'APP-BACKUPS/'))).toEqual(failed)
  // One file of the backup cannot be written.
  expect(await saveWith((folder) => (folder.fails = ({ kind, path: at }) => kind === 'write' && at === `${BACKUP}/MODELS/model02.yml`))).toEqual(failed)
  // Every file is written, but one does not read back the same.
  expect(await saveWith((folder) => (folder.garbles = (at, bytes) => (at === `${BACKUP}/RADIO/radio.yml` ? bytes.slice(1) : bytes)))).toEqual(failed)
})

test('a save after a failed backup makes the backup again', async () => {
  const card = madeUp()
  const folder = folderHolding(card)
  const saver = saverFor(folder)
  const rename = made(renameOnCard(card, 1, 'Boulder'))

  folder.fails = ({ kind, path: at }) => kind === 'write' && at.startsWith('APP-BACKUPS/')
  expect(await saver.save(card, rename.changes)).toEqual({ ok: false, problem: 'backupFailed' })
  folder.fails = () => false
  const result = saved(await saver.save(card, rename.changes))

  expect(result.backup).toBe('2026-10-11_14-03-27')
  expect(sameCard(cardIn(folder), rename.card)).toBe(true)
})

test('the 10 newest backups are kept, and nothing else in the backups folder is touched', async () => {
  const card = madeUp()
  const older = Array.from({ length: 12 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}_08-00-00`)
  const notTheApps = [
    'APP-BACKUPS/notes.txt',
    'APP-BACKUPS/my own copy/MODELS/model00.yml',
    'APP-BACKUPS/2026-01-01_00-00-00 keep/MODELS/model00.yml',
    'APP-BACKUPS/2026-01-01/MODELS/model00.yml',
    // A file, not a folder, with a name of the right shape.
    'APP-BACKUPS/2026-01-02_00-00-00',
  ]
  const there = new Map(card)
  for (const name of older) there.set(`APP-BACKUPS/${name}/MODELS/model00.yml`, text(`${name}\r\n`))
  for (const at of notTheApps) there.set(at, text('not the app\'s\r\n'))
  const folder = folderHolding(there)

  saved(await saverFor(folder).save(card, made(renameOnCard(card, 1, 'Boulder')).changes))

  const kept = backupsIn(folder).map((at) => at.slice('APP-BACKUPS/'.length, -1)).toSorted()
  // The new one, the nine newest of the older ones, and the three folders the app did not make.
  expect(kept.filter((name) => /^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d$/.test(name))).toEqual([...older.slice(3), '2026-10-11_14-03-27'])
  expect(kept).toHaveLength(13)
  for (const at of notTheApps) expect(folder.files().has(at), at).toBe(true)
  expect(folder.log.filter((entry) => entry.startsWith('remove '))).toEqual(older.slice(0, 3).map((name) => `remove APP-BACKUPS/${name}/`))
})

test('older backups that cannot be removed do not stop a save', async () => {
  const card = madeUp()
  const there = new Map(card)
  for (let day = 1; day <= 11; day += 1) there.set(`APP-BACKUPS/2026-09-${String(day).padStart(2, '0')}_08-00-00/RADIO/radio.yml`, text('older\r\n'))
  const folder = folderHolding(there)
  folder.fails = ({ kind, path: at }) => kind === 'remove' && at.startsWith('APP-BACKUPS/')
  const rename = made(renameOnCard(card, 1, 'Boulder'))

  const result = saved(await saverFor(folder).save(card, rename.changes))

  expect(sameCard(result.card, rename.card)).toBe(true)
  expect(backupsIn(folder)).toHaveLength(12)
})

test('a backup\'s name sorts after every backup before it, and is never one already there', () => {
  expect(backupName(WHEN, [])).toBe('2026-10-11_14-03-27')
  expect(backupName(new Date(2026, 0, 2, 3, 4, 5), ['2025-12-31_23-59-59', 'my own copy'])).toBe('2026-01-02_03-04-05')
  // Two in the same second.
  expect(backupName(WHEN, ['2026-10-11_14-03-27'])).toBe('2026-10-11_14-03-28')
  // The computer's clock has been put back: the name is the second after the newest one there.
  expect(backupName(WHEN, ['2026-10-11_14-03-27', '2027-12-31_23-59-59'])).toBe('2028-01-01_00-00-00')
  // Something that is not a backup has the name.
  expect(backupName(WHEN, ['2026-10-11_14-03-27 keep'])).toBe('2026-10-11_14-03-27')

  // Made one after another, with a clock that jumps about, they still sort in the order made.
  const clock = [WHEN, new Date(2026, 9, 11, 13, 0, 0), WHEN, new Date(2026, 9, 11, 14, 3, 30), new Date(2020, 0, 1)]
  const names: string[] = []
  for (const time of clock) names.push(backupName(time, names))
  expect(names).toEqual(names.toSorted())
  expect(new Set(names).size).toBe(names.length)
})

// 4. Carrying out the changes

test('every action is carried out in the order given, and the folder ends up as the new card', async () => {
  const start = madeUp()
  const deleted = made(deleteFromCard(start, 2, { closeUp: false }))
  const actions: [string, Card, CardResult][] = [
    ['rename', start, renameOnCard(start, 1, 'Boulder')],
    ['copy', start, copyOnCard(start, 3, 'Newt')],
    ['delete, leaving the place empty', start, deleted],
    ['delete, closing up', start, deleteFromCard(start, 2, { closeUp: true })],
    ['delete the radio\'s model', start, deleteFromCard(start, 5, { closeUp: true, switchTo: 1 })],
    ['restore', deleted.card, restoreOnCard(deleted.card, deleted.deletedPath)],
    ['move a model', start, moveOnCard(start, 3, 5)],
    ['move two models round a full circle', start, moveOnCard(start, 1, 2)],
    ['move an empty place', start, moveOnCard(start, 4, 1)],
    ['close up', start, closeUpOnCard(start)],
  ]

  for (const [name, card, result] of actions) {
    const action = made(result)
    expect(action.changes.length, `${name} changes something`).toBeGreaterThan(0)
    const folder = folderHolding(card)

    const done = saved(await saverFor(folder).save(card, action.changes))

    expect(sameCard(cardIn(folder), action.card), `${name}: the folder holds the new card`).toBe(true)
    expect(sameCard(done.card, action.card), `${name}: the new card is given back`).toBe(true)
    expect(done.reading, name).toEqual(readCard(action.card))
    // Each change once, in the order the list gave. MODELS/DELETED is made when a change needs it.
    expect(doneToCard(folder).filter((entry) => !entry.startsWith('make ')), `${name}: in order`).toEqual(listed(action.changes))
    expect(doneToCard(folder).filter((entry) => entry.startsWith('make ')), name).toEqual(
      listed(action.changes).some((entry) => entry.startsWith('write MODELS/DELETED/')) && !card.has(deleted.deletedPath)
        ? ['make MODELS/DELETED/']
        : [],
    )
  }
})

test('a change that is undone puts the folder back exactly as it was', async () => {
  const card = madeUp()
  const folder = folderHolding(card)
  const saver = saverFor(folder)

  const gone = made(deleteFromCard(card, 5, { closeUp: true, switchTo: 1 }))
  const after = saved(await saver.save(card, gone.changes))
  expect(sameCard(cardIn(folder), card)).toBe(false)
  const back = saved(await saver.save(after.card, changesBetween(after.card, card)))

  expect(sameCard(cardIn(folder), card)).toBe(true)
  expect(sameCard(back.card, card)).toBe(true)
})

test('with nothing to change, the browser is not asked and the folder is not touched', async () => {
  const card = madeUp()
  const folder = folderHolding(card)

  const result = saved(await saverFor(folder).save(card, []))

  expect(folder.log).toEqual([])
  expect(folder.opened).toEqual([])
  expect(result.backup).toBeNull()
  expect(result.reading).toEqual(readCard(card))
})

test('a change to a file outside MODELS, MODELS/DELETED and RADIO is refused before anything is asked', async () => {
  const card = madeUp()
  const bytes = text('made up\r\n')
  for (const at of [
    'radio.yml',
    'FIRMWARE/radio.bin',
    'APP-BACKUPS/2026-10-11_14-03-27/MODELS/model00.yml',
    'MODELS/OTHER/model00.yml',
    'MODELS/DELETED/OLDER/0001-model00.yml',
    'MODELS/..',
    'RADIO/.',
    '/MODELS/model00.yml',
    'MODELS/',
  ]) {
    const folder = folderHolding(card)
    await expect(saverFor(folder).save(card, [{ kind: 'write', path: at, bytes }]), at).rejects.toThrow(RangeError)
    await expect(saverFor(folder).save(card, [{ kind: 'remove', path: at }]), at).rejects.toThrow(RangeError)
    expect(folder.log, at).toEqual([])
    expect(sameCard(folder.files(), card), at).toBe(true)
  }
})

test('a step that fails stops the work there, says how many steps were done, and tidies nothing up', async () => {
  const card = madeUp()
  // Moving position 3 to 5 writes two models and the settings, then removes one file.
  const move = made(moveOnCard(card, 3, 5))
  expect(listed(move.changes)).toEqual([
    'write MODELS/model03.yml',
    'write RADIO/radio.yml',
    'write MODELS/model04.yml',
    'remove MODELS/model02.yml',
  ])

  for (let failing = 0; failing < move.changes.length; failing += 1) {
    const { kind, path: at } = move.changes[failing]
    const folder = folderHolding(card)
    folder.fails = (attempt) => attempt.kind === kind && attempt.path === at

    const result = await saverFor(folder).save(card, move.changes)

    expect(result, `step ${failing + 1} failing`).toEqual({ ok: false, problem: 'stoppedPartWay', stepsDone: failing })
    // The folder holds the steps before the one that failed, and nothing was done after it.
    const expected = new Map(applyChanges(card, move.changes.slice(0, failing)))
    // One thing is left behind by the failed step itself. A browser makes a new file, empty, before
    // it lets anything be written to it. So a failed write to a file that was not there leaves an
    // empty file in its place. The saver tidies nothing up, and that includes this.
    if (kind === 'write' && !card.has(at)) expected.set(at, new Uint8Array())
    expect(sameCard(cardIn(folder), expected), `step ${failing + 1} failing: what the folder holds`).toBe(true)
    expect(cardIn(folder).get('MODELS/model03.yml')?.length === 0).toBe(failing === 0)
    expect(doneToCard(folder)).toEqual(listed(move.changes.slice(0, failing)))
    // No model is lost: each one's bytes are still in some file, and the backup is from before.
    const there = [...cardIn(folder).values()]
    for (const position of [1, 2, 3, 5, 6]) {
      expect(there.some((bytes) => sameBytes(bytes, card.get(modelPath(position))!)), `the model from position ${position}`).toBe(true)
    }
    expect(sameBytes(folder.files().get(`${BACKUP}/RADIO/radio.yml`)!, card.get(RADIO_SETTINGS_PATH)!)).toBe(true)
  }
})

test('MODELS and RADIO are never made: a card whose MODELS folder has gone is not given a new one', async () => {
  const card = madeUp()
  // The folder has lost MODELS since the app read it. A copy goes to a place the app holds as
  // empty, so the check before saving has nothing to find wrong.
  const folder = folderHolding(new Map([...card].filter(([at]) => !at.startsWith('MODELS/'))))
  const copy = made(copyOnCard(card, 3, 'Newt'))

  const result = await saverFor(folder).save(card, copy.changes)

  expect(result).toEqual({ ok: false, problem: 'stoppedPartWay', stepsDone: 0 })
  expect(folder.folders().some((at) => at === 'MODELS/')).toBe(false)
  expect(doneToCard(folder)).toEqual([])
})

test('a file that does not read back as it was written is reported, with the step it was written in', async () => {
  const card = madeUp()
  const move = made(moveOnCard(card, 3, 5))

  for (const [step, at] of [[1, 'MODELS/model03.yml'], [2, 'RADIO/radio.yml'], [3, 'MODELS/model04.yml']] as const) {
    const folder = folderHolding(card)
    folder.garbles = (written, bytes) => (written === at ? bytes.slice(0, -2) : bytes)

    expect(await saverFor(folder).save(card, move.changes), at).toEqual({ ok: false, problem: 'wentWrong', step })
    // Every step was carried out. The saver reports what it found and changes nothing more.
    expect(doneToCard(folder)).toEqual(listed(move.changes))
  }

  // A file that should be gone and is not, because something put it back.
  const folder = folderHolding(card)
  folder.fails = (attempt) => {
    if (attempt.kind === 'remove' && attempt.path === 'MODELS/model02.yml') queueMicrotask(() => folder.put('MODELS/model02.yml', text('back again\r\n')))
    return false
  }
  expect(await saverFor(folder).save(card, move.changes)).toEqual({ ok: false, problem: 'wentWrong', step: 4 })
})

test('a spare file that is written and then removed is checked as removed', async () => {
  const card = madeUp()
  // Two models swapping places need a spare copy while they do. It is gone again at the end.
  const swap = made(moveOnCard(card, 1, 2))
  expect(listed(swap.changes)).toEqual([
    'write MODELS/DELETED/0001-model00.yml',
    'write MODELS/model00.yml',
    'write MODELS/model01.yml',
    'remove MODELS/DELETED/0001-model00.yml',
  ])
  const folder = folderHolding(card)

  const result = saved(await saverFor(folder).save(card, swap.changes))

  expect(sameCard(result.card, swap.card)).toBe(true)
  expect([...cardIn(folder).keys()].some((at) => at.startsWith('MODELS/DELETED/'))).toBe(false)
})
