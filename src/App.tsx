import { useEffect, useReducer, useRef } from 'react'
import styles from './App.module.css'
import { Header } from './components/Header.tsx'
import { MT12 } from './domain/catalog.ts'
import { ReviewerPanel } from './review/ReviewerPanel.tsx'
import { SAMPLE_CURRENT_MODEL_ID, SAMPLE_MODELS } from './sample/sampleModels.ts'
import { ConnectScreen } from './screens/connect/ConnectScreen.tsx'
import { FinishScreen } from './screens/finish/FinishScreen.tsx'
import { ModelsScreen } from './screens/models/ModelsScreen.tsx'
import { ComingNextScreen } from './screens/placeholder/ComingNextScreen.tsx'
import { RadioSetupScreen } from './screens/radioSetup/RadioSetupScreen.tsx'
import { isReady, reducer, type AppState } from './state/appState.ts'
import { goTo, paths, useHashRoute } from './state/useHashRoute.ts'
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

  // After moving to another page, start keyboard and screen reader users at the top of it.
  useEffect(() => {
    if (route !== firstRoute.current) main.current?.focus()
  }, [route])

  function connect() {
    dispatch({ type: 'connectStarted' })
    connectTimer.current = window.setTimeout(() => {
      dispatch({ type: 'connectSucceeded', models: SAMPLE_MODELS, currentModelId: SAMPLE_CURRENT_MODEL_ID })
    }, SIMULATED_CONNECT_MS)
  }

  const ready = isReady(state)
  const text = strings.comingNext
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
  } else if (route.name === 'addModel') {
    screen = <ComingNextScreen title={text.add.title} body={text.add.body} backLabel={text.backToModels} />
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
        onSave={(baseFitting) => {
          dispatch({ type: 'radioSetupSaved', baseFitting })
          goTo(paths.home)
        }}
      />
    )
  } else {
    screen = <ModelsScreen state={state} dispatch={dispatch} />
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
