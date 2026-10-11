import { expect, test } from 'vitest'
import { readDocument, withValueAt } from '../files/document.ts'
import { checkModelName } from './modelName.ts'

test('a name is checked for being empty, too long or already used', () => {
  expect(checkModelName('Pebble', [])).toBeNull()
  expect(checkModelName('   ', [])).toBe('empty')
  expect(checkModelName('Eleven chars', [])).toBe('tooLong')
  expect(checkModelName(' pebble ', ['Pebble'])).toBe('alreadyUsed')
})

test('a name for a real card has only plain characters, with no double quote and no backslash', () => {
  const forCard = (name: string) => checkModelName(name, [], { plainOnly: true })

  for (const fine of ['Pebble', 'Rig 01', 'A-b_c.d', "Sam's #2", '(Mud) & Co', 'x+y=z!', '~<>?/:;']) expect(forCard(fine), fine).toBeNull()
  for (const refused of ['Rock "n"', 'back\\slash', 'Café', 'Größe', 'Truck 🚚', 'tab\there', '日本']) {
    expect(forCard(refused), refused).toBe('notPlain')
  }
  // The other rules still hold, and a name that breaks this one is told so first.
  expect(forCard('  ')).toBe('empty')
  expect(forCard('Eleven chars')).toBe('tooLong')
  expect(forCard('Café au lait long')).toBe('notPlain')
  expect(checkModelName('pebble', ['Pebble'], { plainOnly: true })).toBe('alreadyUsed')

  // Without the rule, as for the sample models, any character is taken.
  expect(checkModelName('Café', [])).toBeNull()
})

test('the plain rule lets through exactly the characters the radio\'s file can hold in a name', () => {
  const read = readDocument('header:\r\n   name: "Pebble"\r\n')
  if (!read.ok) throw new Error('the made-up lines could not be read')

  // Every character up to the end of the Latin letters with accents, and a few from further on.
  const characters = [...Array.from({ length: 0x250 }, (_, code) => String.fromCharCode(code)), '€', '日', '🚚']
  for (const character of characters) {
    const name = `a${character}b`
    const fileTakesIt = withValueAt(read.document, 'header.name', name).ok
    const ruleTakesIt = checkModelName(name, [], { plainOnly: true }) === null
    expect(ruleTakesIt, `the character with code ${character.codePointAt(0)}`).toBe(fileTakesIt)
  }
})
