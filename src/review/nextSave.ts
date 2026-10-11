// For reviewers only, and not part of the product: a switch that makes the next save to a made-up
// card go wrong, so that what the app says about it can be looked at.
//
// It only works on a card opened from a "Real card" link, which is kept in the browser's private
// storage. A folder a person picked is never touched by it. See privateFolder.ts for how each way
// of going wrong is brought about.

/** A way the next save can be made to go wrong. */
export type NextSave =
  /** The browser says the app may not change the files. */
  | 'notAllowed'
  /** Something else changes the card just before the save. */
  | 'cardChanged'
  /** The backup cannot be made. */
  | 'backupFailed'
  /** One of the changes fails, with the ones before it already made. */
  | 'stopsPartWay'
  /** The save never ends. It is how the "Saving…" state is held still to be looked at. */
  | 'neverEnds'

/** The ways the switch in the reviewer panel offers. */
export const NEXT_SAVE_WAYS = ['notAllowed', 'cardChanged', 'backupFailed', 'stopsPartWay'] as const

let way: NextSave | null = null
const listeners = new Set<() => void>()

function set(next: NextSave | null) {
  way = next
  for (const listener of listeners) listener()
}

export const nextSave = {
  get: (): NextSave | null => way,
  set,
  /** The way the save that is starting should go wrong. It is used up: the save after it works again. */
  take(): NextSave | null {
    const taken = way
    if (taken !== null) set(null)
    return taken
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
