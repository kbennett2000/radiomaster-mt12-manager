// A developer tool: says what the app makes of each of the radio's files in a folder.
//
//   npm run inspect -- <folder>
//
// It prints one line for each .yml file: the file name; whether it is a model, the radio's
// settings or not recognised; the model's name; the receiver type by its name in the app's list;
// and "exact" when writing what was read gives the same bytes, or the first line that differs.
//
// It only reads. It never writes to the folder. It finishes with an error if any file does not
// come back exact, so it can be used as a check.
//
// The reading itself is the app's own code in src/files/, loaded here through Vite, which the
// repo already has. Nothing is installed for this.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const folder = process.argv[2]
if (!folder) {
  console.error('Give the folder to look in:  npm run inspect -- <folder>')
  process.exit(2)
}

let names
try {
  names = (await readdir(folder)).filter((name) => name.toLowerCase().endsWith('.yml')).sort()
} catch {
  console.error(`Cannot read the folder ${folder}`)
  process.exit(2)
}
if (names.length === 0) {
  console.error(`No .yml files in ${folder}`)
  process.exit(2)
}

const { module } = await runnerImport('/src/files/inspect.ts', { root, configFile: false, logLevel: 'silent' })

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
