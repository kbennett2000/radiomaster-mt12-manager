import { useEffect, useLayoutEffect, useReducer, useRef } from 'react'
import styles from './App.module.css'
import { Header } from './components/Header.tsx'
import { MT12 } from './domain/catalog.ts'
import { ReviewerPanel } from './review/ReviewerPanel.tsx'
import { SAMPLE_CURRENT_MODEL_ID, SAMPLE_MODELS } from './sample/sampleModels.ts'
import { AddModelScreen } from './screens/addModel/AddModelScreen.tsx'
import { BindScreen } from './screens/addModel/BindScreen.tsx'
import { ConnectScreen } from './screens/connect/ConnectScreen.tsx'
import { FinishScreen } from './screens/finish/FinishScreen.tsx'
import { ModelsScreen } from './screens/models/ModelsScreen.tsx'
import { ComingNextScreen } from './screens/placeholder/ComingNextScreen.tsx'
import { RadioSetupScreen } from './screens/radioSetup/RadioSetupScreen.tsx'
import { isReady, reducer, type AppState } from './state/appState.ts'
import { goTo, paths, redirectTo, useHashRoute } from './state/useHashRoute.ts'
import { strings } from './strings/en.ts'

// Connect is simulated in this cycle: after a short pause it succeeds and loads the sample data.
const SIMULATED_CONNECT_MS = 1200

function App({ initialState }: { initialState: AppState }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const route = useHashRoute()
  const main = useRef<HTMLElement>(null)
  const connectTimer = useRef<number | undefined>(undefined)
  const firstRoute = useRef(route)

  useEffect(() => () => window.clearTimeout(connectTimer.current), [])

  // A new page starts at its top. This runs before any page's own scrolling, such as the list
  // bringing a newly added row into view.
  useLayoutEffect(() => {
    if (route !== firstRoute.current) document.documentElement.scrollTop = 0
  }, [route])

  // After moving to another page, start keyboard and screen reader users at the top of it.
  useEffect(() => {
    if (route !== firstRoute.current) main.current?.focus({ preventScroll: true })
  }, [route])

  function connect() {
    dispatch({ type: 'connectStarted' })
    connectTimer.current = window.setTimeout(() => {
      dispatch({ type: 'connectSucceeded', models: SAMPLE_MODELS, currentModelId: SAMPLE_CURRENT_MODEL_ID })
    }, SIMULATED_CONNECT_MS)
  }

  const ready = isReady(state)
  const text = strings.comingNext
  const wizard = ready ? state.wizard : null
  const onWizardPage = route.name === 'addModel' || route.name === 'bind'
  const wizardStep = route.name === 'addModel' ? route.step : null
  // The model the wizard added last. The wizard's last page, Bind your receiver, is about it.
  const justAdded = ready ? state.models.find((model) => model.id === state.lastAddedModelId) : undefined
  const onBindPage = route.name === 'bind' && !wizard && justAdded !== undefined

  // Keep a note of the step on screen, so the wizard can stay put if the person starts to leave.
  // A wizard page with nothing to show goes to the list: a stale address, or a step of a wizard
  // that has already added its model. That is what stops the browser's Back adding it twice.
  useEffect(() => {
    if (!ready || !onWizardPage) return
    if (wizard && wizardStep && wizard.step !== wizardStep) dispatch({ type: 'wizardStepShown', step: wizardStep })
    else if (!wizard && !onBindPage) redirectTo(paths.home)
  }, [ready, onWizardPage, wizard, wizardStep, onBindPage])

  // The address is changed first each time, so the page and the state never disagree for a moment.
  function startWizard(position?: number) {
    goTo(paths.addStep('name'))
    dispatch({ type: 'wizardOpened', position })
  }
  const modelToEdit =
    route.name === 'editModel' ? state.models.find((model) => model.id === route.modelId) : undefined

  let screen
  if (!ready && route.name === 'openFiles') {
    screen = (
      <ComingNextScreen title={text.openFiles.title} body={text.openFiles.body} backLabel={text.backToConnect} />
    )
  } else if (!ready) {
    screen = (
      <ConnectScreen
        state={state}
        onConnect={connect}
        onBaseFittingAnswered={(baseFitting) => dispatch({ type: 'baseFittingAnswered', baseFitting })}
      />
    )
  } else if (wizard) {
    // The wizard stays on screen while it is open. If the address has moved off it, by Cancel, a
    // header link or the browser's Back, that is the person starting to leave, so it asks first.
    screen = (
      <AddModelScreen
        wizard={wizard}
        step={wizardStep ?? wizard.step}
        models={state.models}
        baseFitting={state.radio.baseFitting}
        dispatch={dispatch}
        leaving={!onWizardPage}
        onKeepGoing={() => goTo(paths.addStep(wizard.step))}
        onLeave={() => dispatch({ type: 'wizardLeft' })}
        onFinished={() => {
          goTo(paths.bind)
          dispatch({ type: 'wizardFinished' })
        }}
      />
    )
  } else if (onBindPage && justAdded) {
    screen = <BindScreen model={justAdded} />
  } else if (onWizardPage) {
    screen = null
  } else if (modelToEdit) {
    screen = (
      <ComingNextScreen
        title={text.edit.title(modelToEdit.name)}
        body={text.edit.body}
        backLabel={text.backToModels}
      />
    )
  } else if (route.name === 'finish') {
    screen = (
      <FinishScreen
        onUnplugged={() => {
          dispatch({ type: 'disconnected' })
          goTo(paths.home)
        }}
      />
    )
  } else if (route.name === 'radioSetup') {
    screen = (
      <RadioSetupScreen
        baseFitting={state.radio.baseFitting}
        whenDeleting={state.whenDeleting}
        onSave={(baseFitting, whenDeleting) => {
          dispatch({ type: 'radioSetupSaved', baseFitting, whenDeleting })
          goTo(paths.home)
        }}
      />
    )
  } else {
    screen = <ModelsScreen state={state} dispatch={dispatch} onAdd={startWizard} />
  }

  return (
    <>
      <button type="button" className={styles.skip} onClick={() => main.current?.focus()}>
        {strings.skipToContent}
      </button>
      <Header connected={ready ? { modelCount: state.models.length, maxModels: MT12.maxModels } : undefined} />
      <main ref={main} className={styles.main} tabIndex={-1}>
        {screen}
      </main>
      <ReviewerPanel />
    </>
  )
}

export default App
