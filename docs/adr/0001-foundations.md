# ADR 0001: Foundations

- Date: 2026-10-10
- Status: accepted

## Context

I'm building a website for owners of the RadioMaster MT12, a pistol-grip radio for RC surface vehicles that runs
EdgeTX. The radio stores one model per vehicle. Its menus are powerful and very hard to use. The site lets people
add, edit and delete models in plain words. Many of them will be new to the hobby.

## Decisions

1. **Stack.** React, TypeScript and Vite, with npm. The output is a static site. There is no server, no accounts
   and no analytics. Model files never leave the user's computer.
2. **License.** MIT. The copyright line is "Copyright (c) 2026 Kris Bennett".
3. **Repository.** Public on GitHub, named `radiomaster-mt12-manager`.
4. **Display name.** The app's name comes from one constant, `APP_NAME` in `src/config/app.ts`. Its default is
   "radiomaster-mt12-manager". That is a working name and it will change, so nothing else hard-codes it. The page
   title is filled in from the same constant at build time.
5. **Radio support.** The first version supports the MT12 with the internal 4-in-1 multi-protocol module. An ELRS
   version of the radio exists and I will add it later. So the radio module type and the list of receiver types
   are data in `src/domain/catalog.ts`, not logic spread through the code.
6. **EdgeTX is GPL.** I never copy EdgeTX code into this repo.
7. **Feature-based UI.** A model is described as a list of vehicle features. Each feature has a receiver port and
   the radio control that works it. The app is organised around what the vehicle has, never around the radio's
   internal building blocks.
8. **Few dependencies.** The only runtime dependencies are React and React DOM. There is no component library:
   the app is a handful of screens, and CSS Modules reading one theme file cover it. If I add a library later, a
   new ADR will say why.
9. **Reaching the radio (later).** The page will read and write the radio's SD card directly while the radio is
   plugged in by USB. That works in Chrome and Edge only, so "open the files yourself" is the fallback.

## How I apply these

- All user-facing text lives in one file, `src/strings/en.ts`.
- Colours, spacing and type sizes live in one file, `src/theme/theme.css`.
- The types for a model and its features live in `src/domain/`, apart from the screens. Later cycles fill the
  same types from real files, so they are the contract.
- Routing is a small hash router I wrote, and dialogs use the browser's own `<dialog>` element. Neither needs a
  dependency.
- Linting is oxlint, which the Vite scaffold ships. Tests are Vitest with Testing Library.

## Consequences

- With no server there is nothing to host but files, and nothing that can leak a user's models.
- Direct SD card access will not work in Firefox or Safari. Those users get the fallback.
- Adding the ELRS radio should be a data change plus whatever new screens it needs.
- Writing my own router and dialog wrapper means a little more code to own.
