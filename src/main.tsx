import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/theme.css'
import './theme/base.css'
import App from './App.tsx'
import { canOpenRadioDrive } from './platform/browserSupport.ts'
import { initialState } from './state/appState.ts'
import { findScenario } from './state/scenarios.ts'

// "?state=<id>" starts the app in one of the review scenarios. Without it, the app starts as a first visit.
const scenario = findScenario(new URLSearchParams(window.location.search).get('state'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialState={scenario?.state ?? initialState(canOpenRadioDrive())} showOnOpen={scenario?.show} />
  </StrictMode>,
)
