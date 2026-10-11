# ADR 0005: Saving to a card

- Date: 2026-10-11
- Status: accepted

## Context

ADR 0004 turns each thing the app does to a card into a list of file changes, in an order that is safe to stop
in. Until now nothing carried such a list out: the app only read a card. This ADR says how a list is carried
out on the folder a person picked, and what stands between a click and the first byte written.

This is the first code here that can lose someone's models, so it is built to refuse early. Each decision
below is a reason to change nothing.

## Decisions

1. **One place writes.** `src/platform/saveToFolder.ts` is the only code in the product that writes or removes
   a file in a picked folder. The reviewer's made-up cards are written by other code, and that code can only
   reach the browser's private storage.
2. **Permission on the first change.** Connect asks the browser to read and nothing more. The first save asks
   the browser whether the app may change files in that folder. A browser only lets a page ask while a click is
   being handled, so asking is the first thing a save does, and a screen calls a save straight from the click.
   Any answer but yes changes nothing.
3. **The card must be what the app thinks it is.** Before anything is changed, every path the list will write
   or remove is read from the folder, and so is `RADIO/radio.yml`. Each has to match the card the app holds,
   byte for byte. A path the app holds no file for has to have no file. If any differs, something else has
   changed the card, and nothing is changed.
4. **A backup before the first change after each Connect.** Every `MODELS/modelNN.yml`, every file in
   `MODELS/DELETED` and `RADIO/radio.yml` are read from the folder and written under
   `APP-BACKUPS/<date and time>/`, with the same folder names inside. Each copy is read back and compared. If
   the backup cannot be made, or does not match, nothing else is changed, and what was made of it is removed.
   There is one backup for a Connect, not one for each change.
5. **A backup's name sorts in the order made.** It is the computer's date and time, like
   `2026-10-11_14-03-27`. If that would not sort after the newest backup already there, because the clock was
   put back, it is the second after that newest one. So no two names are the same and the oldest sorts first.
6. **Ten backups are kept.** After a backup is made and checked, the app removes its older ones and leaves the
   ten newest. It knows its own by the shape of the name. Any other folder or file in `APP-BACKUPS` is never
   touched.
7. **The changes are made in the order given, one at a time.** `MODELS/DELETED` is made when a change needs
   it. `MODELS` and `RADIO` are never made: a card that has lost one is not a card to write to.
8. **Everything written is read back.** When the last change is made, each written path is read and compared,
   and each removed path has to be gone. Then the whole card is read afresh, and that is the card the app
   holds from then on.
9. **A failure stops the work and nothing is tidied up.** The save reports how many steps were done. Tidying
   up would be more writing to a card that has just refused a write. The order from ADR 0004 means no model is
   lost wherever the work stops, and the radio is not left set to the wrong model. The backup is from before
   any of it.
10. **Nothing outside the card.** A list that names a file anywhere but `MODELS`, `MODELS/DELETED` or `RADIO`
    is refused before the browser is asked anything.

## How I test it

- `src/platform/saveToFolder.test.ts` gives the saver a folder that exists only in memory, and makes each
  thing above fail in turn.
- `npm run test:browser` runs the saver in a real browser, on a made-up card in the browser's private storage.
  It carries out every action, reads the folder back, undoes the action, and reads the folder back again.

## Consequences

- The check looks only at the files a change touches, and the settings. A difference somewhere else on the
  card does not stop a save. It reaches the app afterwards, in the card that is read afresh.
- After a save stops part way, the app's own picture of the card is out of date. It has to read the card again
  before it does anything more.
- An older backup that cannot be removed does not stop a save. It is tried again after the next backup.
- A save with nothing to change asks the browser nothing and makes no backup.
- No test here sees the browser's own question, or a folder on a real disk. Private storage needs no
  permission, so the browser always says yes there. Both have to be tried by hand on a real card.
