// Finding a receiver by what the person types.
// Capitals, spaces and dashes never matter, so "dumbo rc", "DumboRC" and "x6-f" all find what they should.

const tidy = (words: string): string => words.toLowerCase().replace(/[\s\-‐-―]/g, '')

/**
 * True when what was typed matches any of the words given for one receiver: its brand, what its
 * label says, and its receiver type name.
 *
 * It matches if the whole of what was typed is found once spaces are taken out ("scx 24" finds
 * "SCX24"), or if every word typed is found somewhere ("traxxas 6519" finds the Traxxas entry
 * that lists 6519).
 */
export function matchesSearch(typed: string, words: readonly string[]): boolean {
  const whole = tidy(typed)
  if (whole === '') return true
  const hay = words.map(tidy).join('|')
  if (hay.includes(whole)) return true
  return typed
    .split(/\s+/)
    .map(tidy)
    .filter((word) => word !== '')
    .every((word) => hay.includes(word))
}
