/// <reference types="node" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { strings } from '../strings/en.ts'
import {
  bytesFromDocument,
  bytesFromText,
  documentFromBytes,
  entriesAt,
  itemsAt,
  readDocument,
  valueAt,
  withValueAt,
  writeDocument,
  type Document,
  type Refusal,
} from './document.ts'
import { modelNameOf, receiverNumbersOf, withModelName } from './model.ts'
import { currentModelNumberOf } from './radioSettings.ts'

// Three made-up files in the radio's layout: two models and the radio's settings. The names and
// values in them are invented. Between them they hold every shape of line the real files have.
const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'testdata')
const FILES = ['model-rockhopper.yml', 'model-dune-dart.yml', 'radio.yml'] as const
type FileName = (typeof FILES)[number]

const bytesOf = (name: FileName): Uint8Array => new Uint8Array(readFileSync(path.join(folder, name)))
const textOf = (name: FileName): string => new TextDecoder().decode(bytesOf(name))

function read(name: FileName): Document {
  const result = documentFromBytes(bytesOf(name))
  if (!result.ok) throw new Error(`${name} was refused at line ${result.line}: ${result.reason}`)
  return result.document
}

function readText(text: string): Document {
  const result = readDocument(text)
  if (!result.ok) throw new Error(`refused at line ${result.line}: ${result.reason}`)
  return result.document
}

/** The numbers of the lines on which two documents differ, counted from 1. */
const linesThatDiffer = (first: Document, second: Document): number[] =>
  first.lines.flatMap((line, index) => (line === second.lines[index] ? [] : [index + 1]))

// Reading and writing

test('reading a file and writing it straight back gives the same bytes', () => {
  for (const name of FILES) {
    const original = bytesOf(name)
    // The made-up files really are in the radio's layout: every line ends CR LF, the last one too.
    const text = textOf(name)
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/)

    expect(Array.from(bytesFromDocument(read(name)))).toEqual(Array.from(original))
  }
})

// Lookups

test('a value is found by its path, whatever way it is written', () => {
  const model = read('model-rockhopper.yml')

  expect(valueAt(model, 'header.name')).toBe('Rockhopper') // text in double quotes
  expect(valueAt(model, 'expoData.1.name')).toBe('Soft start') // quoted, with a space
  expect(valueAt(model, 'logicalSw.1.def')).toBe('L1,!L2') // quoted, with a comma and "!"
  expect(valueAt(model, 'mixData.0.name')).toBe('') // empty quotes
  expect(valueAt(model, 'switchWarningState')).toBe('') // nothing at all after the colon
  expect(valueAt(model, 'limitData.0.min')).toBe('120') // a bare number
  expect(valueAt(model, 'limitData.0.max')).toBe('-140') // a negative number
  expect(valueAt(model, 'hatsMode')).toBe('GLOBAL') // a bare word
  expect(valueAt(model, 'semver')).toBe('2.10.0') // a bare version with dots
  expect(valueAt(model, 'moduleData.0.subType')).toBe('74,2') // a bare pair of numbers
  expect(valueAt(model, 'mixData.0.flightModes')).toBe('000000000') // digits with leading zeros
  expect(valueAt(model, 'mixData.2.srcRaw')).toBe('ls(4)') // a bare word with brackets
  expect(valueAt(model, 'screens.0.u.lines.1.sources.0.val')).toBe('I4') // seven levels down

  // Nothing there, and a path that stops at a group or a list.
  expect(valueAt(model, 'header.colour')).toBeNull()
  expect(valueAt(model, 'header')).toBeNull()
  expect(valueAt(model, 'mixData')).toBeNull()
  expect(valueAt(model, 'header.name.more')).toBeNull()

  // Groups keyed by a name, written with no space after the colon. Only the radio's settings have them.
  const radio = read('radio.yml')
  expect(valueAt(radio, 'calib.TH.mid')).toBe('820')
  expect(valueAt(radio, 'switchConfig.FL1.type')).toBe('2pos') // a bare word that starts with a digit
  expect(valueAt(radio, 'ttsLanguage')).toBe('en')
})

test('the items of a list come in order, and each can be looked into', () => {
  const model = read('model-rockhopper.yml')
  const items = itemsAt(model, 'mixData')!

  expect(items).toHaveLength(3)
  expect(items.map((item) => valueAt(item, 'weight'))).toEqual(['100', '65', '100'])
  // An item can hold a group of its own.
  expect(valueAt(items[1], 'curve.value')).toBe('80')
  expect(valueAt(items[0], 'curve.value')).toBeNull()
  // In a path, an item is named by its place in the list, counted from 0.
  expect(valueAt(model, 'mixData.1.curve.value')).toBe('80')
  expect(valueAt(model, 'mixData.3.weight')).toBeNull()

  expect(itemsAt(model, 'header')).toBeNull()
  expect(itemsAt(model, 'nothingHere')).toBeNull()
  // A key with nothing under it could be a list with no items.
  expect(itemsAt(model, 'switchWarningState')).toEqual([])
})

test('the entries of a numbered group come with their numbers, which can skip', () => {
  const model = read('model-rockhopper.yml')
  const limits = entriesAt(model, 'limitData')!

  expect(limits.map((entry) => entry.number)).toEqual([0, 1, 4])
  expect(valueAt(limits[2].group, 'min')).toBe('-30')
  // In a path, an entry is named by its own number.
  expect(valueAt(model, 'limitData.4.min')).toBe('-30')
  expect(valueAt(model, 'limitData.2.min')).toBeNull()

  // A numbered group inside a numbered group.
  expect(entriesAt(model, 'flightModeData.0.trim')!.map((entry) => valueAt(entry.group, 'value'))).toEqual(['12', '-3'])
  expect(entriesAt(read('radio.yml'), 'trainer.mix')!.map((entry) => entry.number)).toEqual([0, 1])

  expect(entriesAt(model, 'mixData')).toBeNull()
  expect(entriesAt(model, 'header.name')).toBeNull()
})

// The one kind of change

test('setting a value changes that one line, and keeps it quoted or bare as it was', () => {
  const model = read('model-rockhopper.yml')

  const bare = withValueAt(model, 'limitData.1.max', '-55')
  if (!bare.ok) throw new Error(bare.problem)
  const [bareLine] = linesThatDiffer(model, bare.document)
  expect(linesThatDiffer(model, bare.document)).toHaveLength(1)
  expect(bare.document.lines[bareLine - 1]).toBe('      max: -55')
  expect(valueAt(bare.document, 'limitData.1.max')).toBe('-55')

  const quoted = withValueAt(model, 'inputNames.4.val', 'Diff')
  if (!quoted.ok) throw new Error(quoted.problem)
  const [quotedLine] = linesThatDiffer(model, quoted.document)
  expect(linesThatDiffer(model, quoted.document)).toHaveLength(1)
  expect(quoted.document.lines[quotedLine - 1]).toBe('      val: "Diff"')

  // The app never adds a line, so the path must already hold a value.
  expect(withValueAt(model, 'header.colour', 'red')).toEqual({ ok: false, problem: 'noSuchValue' })
  expect(withValueAt(model, 'header', 'red')).toEqual({ ok: false, problem: 'noSuchValue' })
  // Text the layout cannot hold as the line is written.
  expect(withValueAt(model, 'header.name', 'Rock "hopper"')).toEqual({ ok: false, problem: 'cannotBeWritten' })
  expect(withValueAt(model, 'limitData.1.max', 'a lot')).toEqual({ ok: false, problem: 'cannotBeWritten' })
  // The document that was read is not changed by any of this.
  expect(writeDocument(model)).toBe(textOf('model-rockhopper.yml'))
})

// What the app reads from a model and from the radio's settings

test('a model gives its name and its receiver numbers, and the radio settings give the current model', () => {
  const rockhopper = read('model-rockhopper.yml')
  const duneDart = read('model-dune-dart.yml')
  const radio = read('radio.yml')

  expect(modelNameOf(rockhopper)).toBe('Rockhopper')
  expect(modelNameOf(duneDart)).toBe('Dune Dart')
  expect(modelNameOf(radio)).toBeNull()

  expect(receiverNumbersOf(rockhopper)).toEqual([74, 2])
  expect(receiverNumbersOf(duneDart)).toEqual([99, 1])
  // Nothing when the file does not have them.
  const without = readText(textOf('model-dune-dart.yml').replace('      subType: 99,1\r\n', ''))
  expect(receiverNumbersOf(without)).toBeNull()
  expect(receiverNumbersOf(radio)).toBeNull()

  // Counted from 0, as the radio writes it.
  expect(currentModelNumberOf(radio)).toBe(1)
  expect(currentModelNumberOf(rockhopper)).toBeNull()
})

test('renaming a model changes exactly one line', () => {
  const model = read('model-dune-dart.yml')
  const renamed = withModelName(model, 'Sand Flea')
  if (!renamed.ok) throw new Error(renamed.problem)

  expect(linesThatDiffer(model, renamed.document)).toEqual([3])
  expect(renamed.document.lines[2]).toBe('   name: "Sand Flea"')
  expect(renamed.document.lines).toHaveLength(model.lines.length)
  expect(modelNameOf(renamed.document)).toBe('Sand Flea')

  // Renaming it back gives the bytes it started with.
  const back = withModelName(renamed.document, 'Dune Dart')
  if (!back.ok) throw new Error(back.problem)
  expect(Array.from(bytesFromDocument(back.document))).toEqual(Array.from(bytesOf('model-dune-dart.yml')))
})

test('a name that is too long is refused, and so is any other name the rules refuse', () => {
  const model = read('model-dune-dart.yml')

  expect(withModelName(model, 'Sand Flea XL')).toEqual({ ok: false, problem: 'tooLong' })
  expect(withModelName(model, '   ')).toEqual({ ok: false, problem: 'empty' })
  expect(withModelName(model, 'rockhopper', ['Rockhopper'])).toEqual({ ok: false, problem: 'alreadyUsed' })
  // A name the file's layout cannot hold.
  expect(withModelName(model, 'Sand "X"')).toEqual({ ok: false, problem: 'cannotBeWritten' })
  expect(withModelName(model, 'Sandfl\u00e9a')).toEqual({ ok: false, problem: 'cannotBeWritten' })
  // The radio's settings have no model name to change.
  expect(withModelName(read('radio.yml'), 'Sand Flea')).toEqual({ ok: false, problem: 'notAModel' })
})

// Files that are not in the layout

test('a broken file is refused with the number of the line that is wrong', () => {
  const good = textOf('model-dune-dart.yml')
  const lines = good.split('\r\n').slice(0, -1)
  /** The good file with one line swapped for other lines. */
  const withLine = (number: number, ...instead: string[]): string =>
    lines.toSpliced(number - 1, 1, ...instead).map((line) => `${line}\r\n`).join('')

  const broken: [what: string, text: string, refusal: Refusal][] = [
    ['a line that ends with a line feed only', good.replace('trimInc: 0\r\n', 'trimInc: 0\n'), { line: 5, reason: 'lineEnding' }],
    ['a last line with no ending', good.slice(0, -2), { line: lines.length, reason: 'lineEnding' }],
    ['an empty file', '', { line: 1, reason: 'empty' }],
    ['two spaces where three belong', withLine(3, '  name: "Dune Dart"'), { line: 3, reason: 'indent' }],
    ['a line two levels further in', withLine(3, '      name: "Dune Dart"'), { line: 3, reason: 'tooDeep' }],
    ['a line under a value', withLine(5, 'trimInc: 0', '   more: 1'), { line: 6, reason: 'tooDeep' }],
    ['a line with no colon', withLine(4, 'telemetry'), { line: 4, reason: 'notALine' }],
    ['a blank line', withLine(4, ''), { line: 4, reason: 'notALine' }],
    ['a tab', withLine(3, '\tname: "Dune Dart"'), { line: 3, reason: 'notALine' }],
    ['no space after the colon', withLine(4, 'telemetryProtocol:0'), { line: 4, reason: 'notALine' }],
    ['a bare value with a space in it', withLine(3, '   name: Dune Dart'), { line: 3, reason: 'value' }],
    ['a double quote inside the quotes', withLine(3, '   name: "Dune "Dart""'), { line: 3, reason: 'value' }],
    ['a tab inside the quotes', withLine(3, '   name: "Dune\tDart"'), { line: 3, reason: 'value' }],
    ['the same name twice in one group', withLine(5, 'trimInc: 0', 'trimInc: 1'), { line: 6, reason: 'repeatedKey' }],
    ['a list item where there is no list', withLine(5, 'trimInc: 0', ' -'), { line: 6, reason: 'dashOutsideList' }],
    ['a list item with nothing in it', withLine(8, ' -', ' -'), { line: 8, reason: 'emptyItem' }],
  ]
  for (const [what, text, refusal] of broken) {
    expect(readDocument(text), what).toEqual({ ok: false, ...refusal })
    // The plain message names the line.
    expect(strings.files.refused[refusal.reason](refusal.line), what).toContain(String(refusal.line))
  }

  // Bytes that are not text at all, on the second line.
  const notText = bytesFromText(good)
  notText[notText.indexOf(0x0a) + 1] = 0xff
  expect(documentFromBytes(notText)).toEqual({ ok: false, line: 2, reason: 'notText' })
})
