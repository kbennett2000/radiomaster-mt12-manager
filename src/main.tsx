import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/theme.css'
import './theme/base.css'
import App, { type AtStart } from './App.tsx'
import { canOpenRadioDrive } from './platform/browserSupport.ts'
import { initialState } from './state/appState.ts'
import { findScenario } from './state/scenarios.ts'

// "?state=<id>" starts the app in one of the review scenarios. Without it, the app starts as a first visit.
const scenario = findScenario(new URLSearchParams(window.location.search).get('state'))

// A scenario with a made-up card has the app open it at the start, and do to it whatever the
// scenario lists. The code that puts the card in the browser's private storage is for reviewers
// only, so it is fetched only when it is asked for.
const card = scenario?.card
const atStart: AtStart | undefined = card && {
  connect: () =>
    import('./review/privateFolder.ts').then((reviewers) => reviewers.privateConnectionWith(card, scenario.nextSave)),
  steps: scenario.steps,
  lastStepNeverEnds: scenario.nextSave === 'neverEnds',
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialState={scenario?.state ?? initialState(canOpenRadioDrive())} atStart={atStart} />
  </StrictMode>,
)
