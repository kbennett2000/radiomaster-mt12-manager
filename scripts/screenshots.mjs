// Saves a picture of every review state, so the screens can be checked by eye.
//
//   npm run screenshots
//
// It serves the built site, reads the list of states from the reviewer panel, and saves the states
// that are new or changed in this cycle, at two window sizes:
//
//   docs/screenshots/cycle-03/        at 1440x900
//   docs/screenshots/cycle-03-1024/   at 1024x768
//
// A page taller than the window also gets a "-full" picture of the whole page. It only ever
// writes into those two folders. Pictures from earlier cycles are left alone.
//
// The script fails if a banned word shows up, a page overflows sideways, the page reports an
// error, the list of 20 models grows taller than its target, or a row of that list runs past
// two lines at 1440px.

import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The groups of states that are new or changed in this cycle. Connect and Finish are not.
const GROUPS = ['models', 'delete']

const SETS = [
  { dir: 'docs/screenshots/cycle-03', width: 1440, height: 900 },
  { dir: 'docs/screenshots/cycle-03-1024', width: 1024, height: 768 },
]

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
    if (!GROUPS.includes(scenario.group)) continue
    await page.goto(new URL(scenario.href, baseUrl).href)
    await settle(page)
    await check(page, scenario.name, set.width)
    await page.screenshot({ path: path.join(outDir, `${scenario.name}.png`) })
    saved++

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const dialogOpen = await page.evaluate(() => Boolean(document.querySelector('dialog[open]')))
    if (pageHeight > set.height && !dialogOpen) {
      // The reviewer tab is pinned to the window, so it has no true place in a whole-page picture.
      await page.addStyleTag({ content: '[data-review-panel] { visibility: hidden }' })
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
