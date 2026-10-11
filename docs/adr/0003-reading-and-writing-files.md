# ADR 0003: Reading and writing the radio's files

- Date: 2026-10-10
- Status: accepted

## Context

The radio keeps each model as one text file, and its own settings in a file called `radio.yml`. Later cycles will
read these files from the radio's SD card, change them and write them back. The radio is strict about how the
files are laid out, and a file it cannot read is a model its owner has lost. So before any screen touches a real
file, I need a reader and a writer I can trust not to damage one.

I checked the layout against 21 real files from a radio: 20 models and its settings. Those files are not in this
repo and never will be. The tests use three made-up files in the same layout, under `src/files/testdata/`.

## Decisions

1. **A file is handed back byte for byte.** A document keeps every line of the file exactly as it was read.
   Writing a document gives those same lines back. The tree the app looks things up in is built beside the lines
   and is never what gets written. So nothing can be reformatted, reordered or dropped by accident, because
   nothing is ever regenerated.
2. **A change rebuilds one line.** The only change so far is a new value on a line that is already there. That
   one line is rebuilt and every other line is left as it was. A quoted value stays quoted and a bare value stays
   bare. The app never adds or removes a line yet.
3. **The reader is my own.** The files are written in a small, fixed part of a much larger format. A general
   reader for that format would accept far more than the radio writes, and its writer would lay a file out its
   own way: different quoting, different indentation, different line endings. That is exactly what the radio
   rejects. A reader that knows only the shapes the radio writes is small enough to check line by line against
   real files. It is also no dependency, and no code from EdgeTX, which is GPL. I learned the layout from the
   files themselves.
4. **Anything else is refused, not guessed at.** A file with a line the reader cannot place is refused, with a
   plain message that names the line. That covers a wrong line ending, indentation that is not a whole level, a
   line that is neither a key nor a list item, and a value written in a way I have not seen. The reader never
   repairs a file.
5. **What the app does not understand is left alone.** The app reads the model's name, the two numbers that
   pick its receiver type, and which model the radio is set to. Everything else in a file means nothing to the
   app yet. It is carried through untouched, which follows from decision 1.
6. **`radio.yml` is not changed yet.** Near its top are `checksum` and `manuallyEdited`. I do not know what the
   radio expects of those two when the file changes. A later cycle must find out before anything writes to it.

## How I apply these

- The code is in `src/files/`, with no screen. `document.ts` is the reader, the writer, the lookups and the one
  change. `model.ts` and `radioSettings.ts` are the few things the app reads and changes.
- `npm run inspect -- <folder>` reads every `.yml` file in a folder and writes each straight back in memory. It
  prints what the app makes of each one, and "exact" when the bytes match. It never writes to the folder.
- One test reads the real folder when the computer has it, and is skipped when it does not.

## Consequences

- A file from a radio whose files are laid out differently will be refused until the reader learns its shapes.
  That is deliberate: a refusal costs nothing, and a wrong guess could cost a model.
- I do not know how the radio writes a double quote or a backslash inside a name, or a character outside plain
  ASCII. The reader refuses the first two, and a rename refuses all three, until a real file shows how.
- Every new kind of change, such as adding a model or an extra, will need its own way of adding lines that
  matches what the radio writes. This ADR only covers changing a value.
