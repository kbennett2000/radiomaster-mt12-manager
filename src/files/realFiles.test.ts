/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { bytesFromDocument, documentFromBytes } from './document.ts'
import { modelNameOf, withModelName } from './model.ts'

// Real files from a radio, when this computer has them: 20 models and the radio's settings.
// They are never part of the repo, and nothing from inside them is written here. On a computer
// without the folder this test is skipped, so the tests still pass everywhere.
const folder = path.join(os.homedir(), 'Desktop', 'mt12-models')

test.skipIf(!existsSync(folder))('every real file comes back byte for byte, also after a rename and back', () => {
  const names = readdirSync(folder).filter((name) => name.endsWith('.yml'))
  expect(names).toHaveLength(21)

  let models = 0
  for (const name of names) {
    const original = Array.from(readFileSync(path.join(folder, name)))
    const read = documentFromBytes(Uint8Array.from(original))
    if (!read.ok) throw new Error(`${name} was refused at line ${read.line}: ${read.reason}`)
    expect(Array.from(bytesFromDocument(read.document)), name).toEqual(original)

    const ownName = modelNameOf(read.document)
    if (ownName === null) continue
    models += 1

    // Rename the model: one line changes, and it is the line with the name.
    const other = ownName === 'Renamed' ? 'Renamed 2' : 'Renamed'
    const renamed = withModelName(read.document, other)
    if (!renamed.ok) throw new Error(`${name} could not be renamed: ${renamed.problem}`)
    expect(modelNameOf(renamed.document), name).toBe(other)
    const changed = read.document.lines.filter((line, index) => line !== renamed.document.lines[index])
    expect(changed, name).toHaveLength(1)
    expect(Array.from(bytesFromDocument(renamed.document)), name).not.toEqual(original)

    // Rename it back: the bytes are the ones the file started with.
    const back = withModelName(renamed.document, ownName)
    if (!back.ok) throw new Error(`${name} could not be renamed back: ${back.problem}`)
    expect(Array.from(bytesFromDocument(back.document)), name).toEqual(original)
  }
  expect(models).toBe(20)
})
