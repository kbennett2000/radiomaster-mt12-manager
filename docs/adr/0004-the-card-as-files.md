# ADR 0004: The card as files

- Date: 2026-10-11
- Status: accepted

## Context

ADR 0003 covers one file: read it, change one value, hand it back byte for byte. The app also has to copy,
move, delete, restore and rename models, and each of those is a change to which files are on the radio's card
and what they are called. This ADR says how the card is laid out, and how the app changes it without ever
losing a model.

I checked each fact below against a copy of a real card. That copy is not in this repo. The tests use a small
made-up card under `src/files/testdata/card/`.

## Decisions

1. **A position is a file name.** A model is the file `MODELS/modelNN.yml`, where NN is two digits from 00 to
   59. Position 1 in the app is `model00.yml` and position 60 is `model59.yml`. A number with no file is an
   empty place. So moving a model means carrying its bytes, unchanged, to the file for its new position.
2. **The radio's current model is a number.** `RADIO/radio.yml` has a `currModel` line with the NN of the model
   the radio is set to. When that model's file moves, `currModel` is rewritten to follow it. When it does not
   move, `radio.yml` is not written at all.
3. **The position rules have one home.** Where a model goes is decided by `src/domain/positions.ts`, the same
   rules ADR 0002 describes and the screens use. The card code asks those rules and then carries the files to
   match. It decides nothing about positions itself.
4. **Every action is a pure function.** It takes a card, which is just paths and bytes, and returns a new card.
   It touches no file. Beside the new card it returns the list of file changes that turns the old card into the
   new one. A change is "write these bytes to this path" or "remove this path".
5. **Writes come before removes.** If the work stops part way, by a pulled cable or a closed window, no model
   may be lost. So in every list all writes come first: a model is written to its new file before its old file
   is removed.
6. **A model's only copy is never written over.** Writes before removes is not enough when one model's file is
   written over another's. So a write over a file that holds a model's only copy waits until that model has been
   written somewhere else. When models swap round in a full circle, with no empty place to begin from, there is
   nothing to wait for. Then the first of them is copied to a spare file before anything is written over, and
   the spare is removed at the end.
7. **The settings follow their model at once.** `radio.yml` names the current model by its file. It is written
   as soon as that model is in its new file, and before the model's old file is written over or removed. Until
   it is written, the file it names is left alone. So wherever the work stops, the radio is set to the model it
   was set to before, or to the one it is being set to. When holding that file back leaves no write that is
   safe to make, a spare file is used, as in decision 6. At first the settings were the last write in a list.
   That could leave the radio set to the wrong model, because another model could be written over the current
   model's old file while the settings still named it.
8. **A deleted model is kept, not destroyed.** Its bytes move to `MODELS/DELETED/`, under a name like
   `0001-model07.yml`. The number at the front is one higher than any deleted model already there, so two names
   can never clash and they sort in the order they were deleted. The rest is the model file it was taken from,
   which records its position. Restoring it carries the bytes back and removes that file.
9. **The spare file is kept in the same place, under the same kind of name.** If the work does stop part way
   through a full circle, the copy is not a stray file. It can be restored like any deleted model.
10. **The checksum.** The first line of `radio.yml` is `checksum: ` and a decimal number. The number is a
    16-bit cyclic redundancy check over every byte after that first line and its line ending: polynomial
    0x1021, starting value 0xFFFF, bits not reflected, no final XOR. Over the characters `123456789` it gives
    10673. I wrote it from that description, and it gives the number in a real `radio.yml`. Whenever the app
    changes `radio.yml` it writes the new number on the first line. The second line, `manuallyEdited`, is left
    alone. This settles what decision 6 of ADR 0003 left open.
11. **Everything else is left exactly as it is.** The app looks at `MODELS/modelNN.yml`, `RADIO/radio.yml` and
    `MODELS/DELETED/`. Any other file in those folders, and everything outside them, is never read into a
    change and never written.

## How I apply these

- `src/files/card.ts` is the card, the paths, and reading a card.
- `src/files/changes.ts` works out the list of changes between two cards, in the safe order.
- `src/files/cardActions.ts` is the six actions: rename, copy, delete, restore, move and close up.
- `npm run inspect -- <folder>` prints what the app makes of a card, and whether its checksum is right.

## Consequences

- A model file the reader refuses still holds its position. It can be moved or deleted, since that only carries
  its bytes. It cannot be renamed or copied, since those need to change a line inside it.
- If `radio.yml` is missing or cannot be read, the app cannot tell which model the radio is set to, so it moves
  nothing. If its checksum is already wrong, the app does not write over it.
- Restoring a model does not change which model the radio is set to, unless the caller asks. Deleting the model
  the radio is set to needs another model to switch to, so the last model on a card cannot be deleted while the
  radio is set to it.
- I have not seen a radio read a card with `MODELS/DELETED/` on it. I am assuming it ignores a folder it does
  not know, as it ignores the `README.txt` beside the models. That has to be checked on a real radio before
  the app writes to one.
- An empty `MODELS/DELETED` folder can be left behind after a restore. A card here is only its files, so there
  is no change that removes a folder.
