// Saves a picture of every review state, so the screens can be checked by eye.
//
//   npm run screenshots
//
// It serves the built site, reads the list of states from the reviewer panel, and saves the states
// that are new or changed in this cycle, at two window sizes:
//
//   docs/screenshots/cycle-10/        at 1440x900
//   docs/screenshots/cycle-10-1024/   at 1024x768
//
// A page taller than the window also gets a "-full" picture of the whole page. It only ever
// writes into those two folders. Pictures from earlier cycles are left alone.
//
// When the list of 20 models is one of the states, it also takes one picture of it with a wider
// font forced on the page, to show that the receiver names still show in full on a computer whose
// font is wider. The app's own font is not changed: the wider font exists only in that picture.
//
// The script fails if a banned word shows up, a page overflows sideways, or the page reports an
// error. On the list of 20 models it also fails if the list grows taller than its target, a row
// runs past two lines at 1440px, or a receiver name or an action is cut short. On a real card's
// list it fails if the page holds a button or anything that can be dragged, because this version
// only reads a card.

import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The states to save in this cycle: every "Real card" state, and the states that changed. Those
// are the pages with new or reworded help, the Connect page after unplugging, which has the new
// link, and the list of 20 sample models, for the header. The open reviewer panel is always saved
// as well.
const STATES = [
  'connect-browser-not-supported',
  'connect-wrong-folder',
  'connect-open-files-coming-next',
  'card-made-up',
  'card-20-models',
  'card-empty-place',
  'card-unknown-receiver',
  'card-unreadable-model',
  'card-wrong-checksum',
  'card-no-models-folder',
  'card-connect-page',
  'models-20',
  'finish-disconnected',
]

// The "Real card" states that end on the card's list. Nothing on that page may change the card.
const READ_ONLY_LISTS = [
  'card-made-up',
  'card-20-models',
  'card-empty-place',
  'card-unknown-receiver',
  'card-unreadable-model',
  'card-wrong-checksum',
]

const SETS = [
  { dir: 'docs/screenshots/cycle-10', width: 1440, height: 900 },
  { dir: 'docs/screenshots/cycle-10-1024', width: 1024, height: 768 },
]

// A font that is wider than the one the app uses here, forced on the page for one picture only.
const WIDER_FONT = { state: 'models-20', family: "Verdana, 'DejaVu Sans', sans-serif", suffix: 'wider-font' }

/** Runs in the page: the receiver names in the list that do not show in full. */
function readCutReceiverNames() {
  return [...document.querySelectorAll('[data-receiver-name]')]
    .filter((cell) => {
      const style = getComputedStyle(cell)
      const hides = style.overflowX !== 'visible' || style.textOverflow !== 'clip'
      return cell.scrollWidth > cell.clientWidth + 1 || (hides && cell.scrollWidth > cell.clientWidth)
    })
    .map((cell) => cell.textContent.trim())
}

/** Runs in the page: the rows of the list with an action running past the row's edge, where it would be cut off. */
function readRowsRunningOver() {
  return [...document.querySelectorAll('main ol > li')]
    .filter((row) => {
      const edge = row.getBoundingClientRect().right
      return [...row.querySelectorAll('a, button')].some((action) => action.getBoundingClientRect().right > edge)
    })
    .map((row) => row.querySelector('h2')?.textContent ?? '')
}

/** Runs in the page: everything on the page that could change something, as short descriptions. */
function readWaysToChange() {
  const main = document.querySelector('main')
  const buttons = [...main.querySelectorAll('button, input, select, textarea, [role="button"]')]
  const draggable = [...main.querySelectorAll('[draggable="true"]')]
  return [...buttons, ...draggable].map((element) => `${element.tagName.toLowerCase()} "${element.textContent.trim()}"`)
}

/** Runs in the page: how wide a few words are in the page's font, in pixels. */
function measureWords(words) {
  const probe = document.createElement('span')
  probe.textContent = words
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap'
  document.querySelector('main').append(probe)
  const width = Math.round(probe.getBoundingClientRect().width)
  probe.remove()
  return width
}

// The 20 sample models must fit in about one and a half windows at 1440x900,
// and no row of that list may run past two lines there.
const DENSITY = { state: 'models-20', width: 1440, maxWindows: 1.5, maxLines: 2 }

/** Runs in the page: how many lines each row of the list takes, as [position and name, lines] pairs. */
function readRowLines() {
  const rows = [...document.querySelectorAll('main ol > li')]
  return rows.map((row) => {
    const line = parseFloat(getComputedStyle(row).lineHeight)
    const style = getComputedStyle(row)
    const inner = row.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    const label = `${row.querySelector('[class*="number"]')?.textContent ?? ''} ${row.querySelector('h2')?.textContent ?? ''}`
    return [label.trim(), Math.round(inner / line)]
  })
}

// Words the app must never show. See src/strings/en.ts.
const BANNED = [
  'channel',
  'mix',
  'logical switch',
  'special function',
  'input',
  'output',
  'curve',
  'expo',
  'protocol',
  'yaml',
  'slot file',
]
const bannedPattern = new RegExp(`\\b(${BANNED.join('|')})(e?s)?\\b`, 'gi')

/** Runs in the page: everything a person could read or have read out to them. */
function readWords() {
  const names = ['aria-label', 'title', 'placeholder', 'alt']
  const fromAttributes = [...document.querySelectorAll(names.map((name) => `[${name}]`).join(','))].flatMap(
    (element) => names.map((name) => element.getAttribute(name) ?? ''),
  )
  return [document.title, document.body.innerText, ...fromAttributes].join('\n')
}

const problems = []
const notes = []

async function check(page, name, width) {
  const words = await page.evaluate(readWords)
  for (const match of words.matchAll(bannedPattern)) {
    problems.push(`${name}: the banned word "${match[0]}" is on the page`)
  }
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  if (overflows) problems.push(`${name}: the page overflows sideways at ${width}px`)
}

async function settle(page) {
  await page.locator('main').waitFor()
  // A "Real card" state opens its made-up card after the page loads. Wait until it has.
  await page.waitForFunction(() => !document.querySelector('[data-opening-card]'))
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
}

async function saveSet(browser, baseUrl, set) {
  const outDir = path.resolve(root, set.dir)
  await mkdir(outDir, { recursive: true })
  for (const file of await readdir(outDir)) {
    if (file.endsWith('.png')) await rm(path.join(outDir, file))
  }

  const context = await browser.newContext({
    viewport: { width: set.width, height: set.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => problems.push(`the page threw an error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`the page logged an error: ${message.text()}`)
  })

  await page.goto(baseUrl)
  await settle(page)
  const scenarios = await page.$$eval('a[data-review-state]', (links) =>
    links.map((link) => ({
      id: link.dataset.reviewState,
      group: link.dataset.reviewGroup,
      href: link.getAttribute('href'),
    })),
  )
  if (scenarios.length === 0) throw new Error('The reviewer panel lists no states.')

  // A state keeps the same number in every set, so the two sets are easy to compare.
  const numbered = scenarios.map((scenario, index) => ({
    ...scenario,
    name: `${String(index + 1).padStart(2, '0')}-${scenario.id}`,
  }))
  let saved = 0

  for (const scenario of numbered) {
    if (!STATES.includes(scenario.id)) continue
    await page.goto(new URL(scenario.href, baseUrl).href)
    await settle(page)
    await check(page, scenario.name, set.width)
    for (const name of await page.evaluate(readCutReceiverNames)) {
      problems.push(`${scenario.name}: the receiver name "${name}" is cut short at ${set.width}px`)
    }
    for (const name of await page.evaluate(readRowsRunningOver)) {
      problems.push(`${scenario.name}: the actions on the row for ${name} are cut off at ${set.width}px`)
    }
    if (READ_ONLY_LISTS.includes(scenario.id)) {
      if ((await page.locator('main ol > li').count()) === 0) {
        problems.push(`${scenario.name}: the card's list did not come up`)
      }
      for (const way of await page.evaluate(readWaysToChange)) {
        problems.push(`${scenario.name}: a real card's page has something that changes things: ${way}`)
      }
    }
    await page.screenshot({ path: path.join(outDir, `${scenario.name}.png`) })
    saved++

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const dialogOpen = await page.evaluate(() => Boolean(document.querySelector('dialog[open]')))
    if (pageHeight > set.height && !dialogOpen) {
      // The reviewer tab is pinned to the window, so it has no true place in a whole-page picture.
      // Neither does a bar that sticks to the bottom of the window: it is shown where it ends up.
      await page.addStyleTag({
        content: '[data-review-panel] { visibility: hidden } [data-sticks-to-window] { position: static }',
      })
      await page.screenshot({ path: path.join(outDir, `${scenario.name}-full.png`), fullPage: true })
    }

    if (scenario.id === DENSITY.state && set.width === DENSITY.width) {
      const windows = pageHeight / set.height
      notes.push(
        `The 20-model list is ${pageHeight}px tall at ${set.width}x${set.height}: ${windows.toFixed(2)} windows.`,
      )
      if (windows > DENSITY.maxWindows) {
        problems.push(
          `${scenario.name}: the page is ${windows.toFixed(2)} windows tall, over the ${DENSITY.maxWindows} target`,
        )
      }
    }

    if (scenario.id === DENSITY.state) {
      const long = (await page.evaluate(readRowLines)).filter(([, lines]) => lines > DENSITY.maxLines)
      const said = long.map(([label, lines]) => `${label} (${lines} lines)`).join(', ')
      if (long.length > 0 && set.width === DENSITY.width) {
        problems.push(`${scenario.name}: rows over ${DENSITY.maxLines} lines at ${set.width}px: ${said}`)
      } else if (long.length > 0) {
        notes.push(`At ${set.width}px these rows run past ${DENSITY.maxLines} lines: ${said}.`)
      }
    }

    if (scenario.id === WIDER_FONT.state) {
      // The same list on a computer with a wider font. Every receiver name must still show in full.
      const usual = await page.evaluate(measureWords, 'DumboRC X-series')
      await page.addStyleTag({
        content: `* { font-family: ${WIDER_FONT.family} !important } [data-review-panel] { visibility: hidden }`,
      })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(150)
      const wider = await page.evaluate(measureWords, 'DumboRC X-series')
      notes.push(
        `Wider font at ${set.width}px: "DumboRC X-series" is ${wider}px wide, against ${usual}px in the app's font.`,
      )
      if (wider <= usual) problems.push(`${scenario.name}: the wider font is not wider, so the picture proves nothing`)
      for (const name of await page.evaluate(readCutReceiverNames)) {
        problems.push(`${scenario.name}: in the wider font, the receiver name "${name}" is cut short at ${set.width}px`)
      }
      for (const name of await page.evaluate(readRowsRunningOver)) {
        problems.push(`${scenario.name}: in the wider font, the actions on the row for ${name} are cut off at ${set.width}px`)
      }
      await page.screenshot({ path: path.join(outDir, `${scenario.name}-${WIDER_FONT.suffix}.png`), fullPage: true })
    }
  }

  {
    // The reviewer panel itself, opened.
    const name = `${String(numbered.length + 1).padStart(2, '0')}-reviewer-panel-open`
    await page.goto(new URL(numbered[0].href, baseUrl).href)
    await settle(page)
    await page.locator('details > summary').click()
    await page.waitForTimeout(150)
    await check(page, name, set.width)
    await page.screenshot({ path: path.join(outDir, `${name}.png`) })
    saved++
  }

  await context.close()
  console.log(`${set.dir}: ${saved} states at ${set.width}x${set.height}`)
}

const server = await preview({ root, logLevel: 'silent', preview: { host: '127.0.0.1', port: 4173 } })
const browser = await chromium.launch()

try {
  for (const set of SETS) await saveSet(browser, server.resolvedUrls.local[0], set)
} finally {
  await browser.close()
  await server.close()
}

for (const note of notes) console.log(note)

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('No banned words, no sideways overflow, no page errors.')
