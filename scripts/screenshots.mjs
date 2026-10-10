// Saves a picture of every review state, so the screens can be checked by eye.
//
//   npm run screenshots
//
// It serves the built site, reads the list of states from the reviewer panel, and saves one PNG per
// state at 1440x900 into docs/screenshots/cycle-01/. A page taller than the window also gets a
// "-full" picture of the whole page. The script fails if a banned word shows up, a page overflows
// sideways, or the page reports an error.
//
// SCREENSHOT_WIDTH and SCREENSHOT_DIR change the window width and where the pictures go.

import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(root, process.env.SCREENSHOT_DIR ?? 'docs/screenshots/cycle-01')
const width = Number(process.env.SCREENSHOT_WIDTH ?? 1440)
const height = 900

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
let number = 0
const nextName = (id) => `${String(++number).padStart(2, '0')}-${id}`

async function check(page, name) {
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

await mkdir(outDir, { recursive: true })
for (const file of await readdir(outDir)) {
  if (file.endsWith('.png')) await rm(path.join(outDir, file))
}

const server = await preview({ root, logLevel: 'silent', preview: { host: '127.0.0.1', port: 4173 } })
const baseUrl = server.resolvedUrls.local[0]
const browser = await chromium.launch()

try {
  const context = await browser.newContext({
    viewport: { width, height },
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
    links.map((link) => ({ id: link.dataset.reviewState, href: link.getAttribute('href') })),
  )
  if (scenarios.length === 0) throw new Error('The reviewer panel lists no states.')

  for (const scenario of scenarios) {
    const name = nextName(scenario.id)
    await page.goto(new URL(scenario.href, baseUrl).href)
    await settle(page)
    await check(page, name)
    await page.screenshot({ path: path.join(outDir, `${name}.png`) })

    const tallerThanWindow = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight && !document.querySelector('dialog[open]'),
    )
    if (tallerThanWindow) {
      await page.screenshot({ path: path.join(outDir, `${name}-full.png`), fullPage: true })
    }
    console.log(`saved ${name}${tallerThanWindow ? ' (and -full)' : ''}`)
  }

  // The reviewer panel itself, opened.
  const panelName = nextName('reviewer-panel-open')
  await page.goto(new URL(scenarios[0].href, baseUrl).href)
  await settle(page)
  await page.locator('details > summary').click()
  await page.waitForTimeout(150)
  await check(page, panelName)
  await page.screenshot({ path: path.join(outDir, `${panelName}.png`) })
  console.log(`saved ${panelName}`)
} finally {
  await browser.close()
  await server.close()
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(`\n${number} states saved to ${path.relative(root, outDir) || outDir} at ${width}x${height}. No banned words, no sideways overflow, no page errors.`)
