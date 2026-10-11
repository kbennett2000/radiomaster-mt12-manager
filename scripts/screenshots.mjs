// Saves a picture of every review state, so the screens can be checked by eye.
//
//   npm run screenshots
//
// It serves the built site, reads the list of states from the reviewer panel, and saves the states
// that are new or changed in this cycle, at two window sizes:
//
//   docs/screenshots/cycle-06/        at 1440x900
//   docs/screenshots/cycle-06-1024/   at 1024x768
//
// A page taller than the window also gets a "-full" picture of the whole page. It only ever
// writes into those two folders. Pictures from earlier cycles are left alone.
//
// A state that shows the labeled picture of the radio also gets a "-picture" close-up of just
// that picture, so each label and its line can be checked against the radio one at a time.
//
// When the list of 20 models is one of the states, it also takes one picture of it with a wider
// font forced on the page, to show that the receiver names still show in full on a computer whose
// font is wider. The app's own font is not changed: the wider font exists only in that picture.
//
// The script fails if a banned word shows up, a page overflows sideways, or the page reports an
// error. On the picture of the radio it fails if two labels overlap, a label overlaps the
// drawing or is cut short, a line does not run from its label to the dot on its control, or two
// lines cross. On the list of 20 models it fails if the list grows taller than its target, a row
// runs past two lines at 1440px, or a receiver name or an action is cut short.

import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The states that are new or changed in this cycle: the new group that shows the picture of the
// radio, and the earlier states of the pages it was added to. The two Extras pages for an
// existing model have new help text.
const GROUPS = ['picture']
const ALSO = [
  'wizard-review',
  'wizard-review-crawler',
  'edit-micro-b',
  'edit-trx4',
  'edit-trx4-22',
  'edit-airboat',
  'edit-tarantula',
  'edit-mini-8ight',
  'edit-extras',
  'edit-extras-held',
  'edit-saved',
  'edit-saved-receiver',
]

const SETS = [
  { dir: 'docs/screenshots/cycle-06', width: 1440, height: 900 },
  { dir: 'docs/screenshots/cycle-06-1024', width: 1024, height: 768 },
]

/**
 * Runs in the page: everything wrong with the labeled picture of the radio, in words. Each label
 * must be clear of the other labels and of the drawing, show in full, and have one line that runs
 * from it to the dot on its control without crossing another line.
 */
function readPictureProblems() {
  const found = []
  const near = (first, second, slack) => Math.hypot(first.x - second.x, first.y - second.y) <= slack
  const overlap = (first, second) =>
    first.left < second.right - 0.5 &&
    second.left < first.right - 0.5 &&
    first.top < second.bottom - 0.5 &&
    second.top < first.bottom - 0.5
  // True when two line segments cross somewhere other than at an end they share.
  const cross = (one, two) => {
    const side = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
    return (
      side(one.from, one.to, two.from) * side(one.from, one.to, two.to) < 0 &&
      side(two.from, two.to, one.from) * side(two.from, two.to, one.to) < 0
    )
  }

  for (const picture of document.querySelectorAll('[data-radio-picture]')) {
    const frame = picture.getBoundingClientRect()
    const labels = [...picture.querySelectorAll('[data-control-label]')].map((element) => ({
      control: element.dataset.controlLabel,
      words: element.textContent.trim(),
      element,
      box: element.getBoundingClientRect(),
    }))
    const drawings = [...picture.querySelectorAll('[data-radio-drawing]')].map((svg) => svg.getBoundingClientRect())
    const lines = [...picture.querySelectorAll('[data-leader-for]')].map((line) => {
      const box = line.ownerSVGElement.getBoundingClientRect()
      const at = (x, y) => ({ x: box.left + Number(line.getAttribute(x)), y: box.top + Number(line.getAttribute(y)) })
      return { control: line.dataset.leaderFor, from: at('x1', 'y1'), to: at('x2', 'y2') }
    })

    if (labels.length === 0) found.push('the picture has no labels')
    for (const label of labels) {
      const { control, words, box, element } = label
      if (box.width === 0 || box.height === 0) found.push(`the label "${words}" has no size`)
      if (element.scrollWidth > element.clientWidth + 1) found.push(`the label "${words}" is cut short`)
      if (box.left < frame.left - 0.5 || box.right > frame.right + 0.5 || box.top < frame.top - 0.5 || box.bottom > frame.bottom + 0.5) {
        found.push(`the label "${words}" runs outside the picture`)
      }
      if (drawings.some((drawing) => overlap(box, drawing))) found.push(`the label "${words}" overlaps the drawing`)
      for (const other of labels) {
        if (other.control < control && overlap(box, other.box)) found.push(`the labels "${other.words}" and "${words}" overlap`)
      }

      const dot = picture.querySelector(`[data-control-dot="${control}"]`)?.getBoundingClientRect()
      const mine = lines.filter((line) => line.control === control)
      if (!dot) found.push(`${control} has no dot on the drawing`)
      if (mine.length !== 1) found.push(`${control} has ${mine.length} lines, not one`)
      if (!dot || mine.length !== 1) continue
      const centre = { x: dot.left + dot.width / 2, y: dot.top + dot.height / 2 }
      if (!near(mine[0].to, centre, 1.5)) found.push(`the line for "${words}" does not end on its dot`)
      // The line starts on the edge of its label, or within a few pixels of it.
      const start = mine[0].from
      const gapX = Math.max(box.left - start.x, 0, start.x - box.right)
      const gapY = Math.max(box.top - start.y, 0, start.y - box.bottom)
      if (Math.hypot(gapX, gapY) > 8) found.push(`the line for "${words}" does not start at its label`)
    }
    for (const line of lines) {
      for (const other of lines) {
        if (other.control < line.control && cross(line, other)) found.push(`the lines for ${other.control} and ${line.control} cross`)
      }
    }
  }
  return found
}

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
    if (!GROUPS.includes(scenario.group) && !ALSO.includes(scenario.id)) continue
    await page.goto(new URL(scenario.href, baseUrl).href)
    await settle(page)
    await check(page, scenario.name, set.width)
    for (const problem of await page.evaluate(readPictureProblems)) {
      problems.push(`${scenario.name}: ${problem} at ${set.width}px`)
    }
    for (const name of await page.evaluate(readCutReceiverNames)) {
      problems.push(`${scenario.name}: the receiver name "${name}" is cut short at ${set.width}px`)
    }
    for (const name of await page.evaluate(readRowsRunningOver)) {
      problems.push(`${scenario.name}: the actions on the row for ${name} are cut off at ${set.width}px`)
    }
    await page.screenshot({ path: path.join(outDir, `${scenario.name}.png`) })
    saved++

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const dialogOpen = await page.evaluate(() => Boolean(document.querySelector('dialog[open]')))
    const picture = page.locator('[data-radio-picture]')
    const hasPicture = (await picture.count()) > 0
    if ((pageHeight > set.height || hasPicture) && !dialogOpen) {
      // The reviewer tab is pinned to the window, so it has no true place in a whole-page picture.
      // Neither does a bar that sticks to the bottom of the window: it is shown where it ends up.
      await page.addStyleTag({
        content: '[data-review-panel] { visibility: hidden } [data-sticks-to-window] { position: static }',
      })
      if (pageHeight > set.height) {
        await page.screenshot({ path: path.join(outDir, `${scenario.name}-full.png`), fullPage: true })
      }
      // A close-up of the labeled picture of the radio, with nothing lying over it.
      if (hasPicture) await picture.first().screenshot({ path: path.join(outDir, `${scenario.name}-picture.png`) })
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
