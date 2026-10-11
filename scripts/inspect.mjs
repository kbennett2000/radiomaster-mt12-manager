// A developer tool: says what the app makes of the radio's files in a folder.
//
//   npm run inspect -- <folder>
//
// When the folder is a card, with MODELS and RADIO inside it, it prints one line for each position
// in use, with its file name, the model's name and its receiver type. It marks the model the
// radio is set to, says whether the checksum in RADIO/radio.yml is right, and lists everything
// else it found in MODELS and RADIO. Nothing else on the card is looked at.
//
// For any other folder it prints one line for each .yml file: the file name; whether it is a
// model, the radio's settings or not recognised; the model's name; the receiver type by its name
// in the app's list; and "exact" when writing what was read gives the same bytes, or the first
// line that differs.
//
// It only reads. It never writes to the folder. It finishes with an error if a file could not be
// read, a checksum is wrong, or a file does not come back exact, so it can be used as a check.
//
// The reading itself is the app's own code in src/files/, loaded here through Vite, which the
// repo already has. Nothing is installed for this.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CARD_FOLDERS = ['MODELS', 'RADIO']

const folder = process.argv[2]
if (!folder) {
  console.error('Give the folder to look in:  npm run inspect -- <folder>')
  process.exit(2)
}

let entries
try {
  entries = await readdir(folder, { withFileTypes: true })
} catch {
  console.error(`Cannot read the folder ${folder}`)
  process.exit(2)
}

const { module } = await runnerImport('/src/files/inspect.ts', { root, configFile: false, logLevel: 'silent' })

const isCard = CARD_FOLDERS.every((name) => entries.some((entry) => entry.isDirectory() && entry.name === name))
if (isCard) {
  // The files and folders under MODELS and RADIO, each by its path from the top of the card.
  const card = new Map()
  const folders = []
  for (const name of CARD_FOLDERS) {
    for (const entry of await readdir(path.join(folder, name), { recursive: true, withFileTypes: true })) {
      const full = path.join(entry.parentPath, entry.name)
      const onCard = path.relative(folder, full).split(path.sep).join('/')
      if (entry.isDirectory()) folders.push(onCard)
      else if (entry.isFile()) card.set(onCard, new Uint8Array(await readFile(full)))
    }
  }
  const { lines, clean } = module.inspectCard(card, folders)
  for (const line of lines) console.log(line)
  if (!clean) {
    console.error('\nSomething on this card is not as the app expects. See above.')
    process.exit(1)
  }
  process.exit(0)
}

const names = entries
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.yml'))
  .map((entry) => entry.name)
  .sort()
if (names.length === 0) {
  console.error(`No .yml files in ${folder}`)
  process.exit(2)
}

const inspections = []
for (const name of names) {
  inspections.push(module.inspectFile(name, new Uint8Array(await readFile(path.join(folder, name)))))
}

// Line the columns up, so a long list is easy to read down.
const widths = inspections[0].fields.map((_, column) =>
  Math.max(...inspections.map((inspection) => inspection.fields[column].length)),
)
for (const { fields } of inspections) {
  console.log(
    fields
      .map((field, column) => (column === fields.length - 1 ? field : field.padEnd(widths[column])))
      .join('  '),
  )
}

const notExact = inspections.filter((inspection) => !inspection.exact).length
if (notExact > 0) {
  console.error(`\n${notExact} of ${inspections.length} files did not come back exact.`)
  process.exit(1)
}
