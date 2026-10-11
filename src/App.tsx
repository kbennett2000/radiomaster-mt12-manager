import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import styles from './App.module.css'
import { Header } from './components/Header.tsx'
import { MT12 } from './domain/catalog.ts'
import { pickFolderToRead } from './platform/pickFolder.ts'
import { readRadioFolder, type FolderToRead } from './platform/radioFolder.ts'
import { ReviewerPanel } from './review/ReviewerPanel.tsx'
import { SAMPLE_CURRENT_MODEL_ID, SAMPLE_MODELS } from './sample/sampleModels.ts'
import { AddModelScreen } from './screens/addModel/AddModelScreen.tsx'
import { BindScreen } from './screens/addModel/BindScreen.tsx'
import { ConnectScreen } from './screens/connect/ConnectScreen.tsx'
import { EditPartScreen } from './screens/editModel/EditPartScreen.tsx'
import { EditScreen } from './screens/editModel/EditScreen.tsx'
import { RebindScreen } from './screens/editModel/RebindScreen.tsx'
import { FinishScreen } from './screens/finish/FinishScreen.tsx'
import { CardModelsScreen } from './screens/models/CardModelsScreen.tsx'
import { ModelsScreen } from './screens/models/ModelsScreen.tsx'
import { ComingNextScreen } from './screens/placeholder/ComingNextScreen.tsx'
import { RadioSetupScreen } from './screens/radioSetup/RadioSetupScreen.tsx'
import { isReady, modelCountOf, reducer, type AppState } from './state/appState.ts'
import { partHasChanges } from './state/edit.ts'
import { goTo, paths, redirectTo, useHashRoute } from './state/useHashRoute.ts'
import { strings } from './strings/en.ts'

interface AppProps {
  initialState: AppState
  /**
   * For reviewers only: gives a folder to open as soon as the app starts, as if the person had
   * just picked it. It is how a made-up card is looked at without the folder picker.
   */
  openAtStart?: () => Promise<FolderToRead>
}

function App({ initialState, openAtStart }: AppProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const route = useHashRoute()
  const main = useRef<HTMLElement>(null)
  const firstRoute = useRef(route)
  const [openingAtStart, setOpeningAtStart] = useState(openAtStart !== undefined)

  // A new page starts at its top, and keyboard and screen reader users start at the top of it
  // too. Both happen before anything the page does for itself, so the list can still bring a newly
  // added row into view, and a confirmation that has just appeared can still take the focus.
  useLayoutEffect(() => {
    if (route === firstRoute.current) return
    document.documentElement.scrollTop = 0
    main.current?.focus({ preventScroll: true })
  }, [route])

  // Reads a folder as the radio's card. A folder the person picked and a reviewer's made-up one
  // both come through here, and through nothing else. This version only reads the card.
  const openFolder = useCallback(async (folder: FolderToRead) => {
    const read = await readRadioFolder(folder)
    dispatch(read.ok ? { type: 'cardConnected', reading: read.reading } : { type: 'wrongFolderPicked' })
  }, [])

  // Connect: the browser's own folder picker, asked to read and nothing more. If it is closed
  // without a folder being chosen, the page goes back to how it was and says nothing.
  async function connect() {
    dispatch({ type: 'connectStarted' })
    const folder = await pickFolderToRead()
    if (folder) await openFolder(folder)
    else dispatch({ type: 'connectCancelled' })
  }

  // The app as it works on sample models, for someone with no radio to hand.
  function trySample() {
    dispatch({ type: 'connectSucceeded', models: SAMPLE_MODELS, currentModelId: SAMPLE_CURRENT_MODEL_ID })
  }

  // A reviewer's made-up card is opened once, when the app starts. While that is going on the
  // page says so on <main>, which is what the picture script waits for.
  useEffect(() => {
    if (!openAtStart) return
    let left = false
    dispatch({ type: 'connectStarted' })
    openAtStart()
      .then((folder) => (left ? undefined : openFolder(folder)))
      .catch((error: unknown) => {
        console.error(error)
        if (!left) dispatch({ type: 'connectCancelled' })
      })
      .finally(() => {
        if (!left) setOpeningAtStart(false)
      })
    return () => {
      left = true
    }
  }, [openAtStart, openFolder])

  const ready = isReady(state)
  // What was read from a real card, once the app is ready to show it. Null for the sample models.
  const card = ready ? state.card : null
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

  // The Edit pages are all about one model: the page for the model, a page for one part of it,
  // and the page that shows how to bind its receiver again.
  const onEditPages = route.name === 'editModel' || route.name === 'editPart' || route.name === 'rebind'
  const routeModel = ready && onEditPages ? state.models.find((model) => model.id === route.modelId) : undefined
  const routePart = route.name === 'editPart' ? route.part : null

  // The page for one part of a model, while it is open. If the address moves off it, by Cancel, a
  // header link or the browser's Back, that is the person leaving. With changes not yet saved the
  // page stays and asks first. With none, it just closes.
  const edit = ready && !wizard ? state.edit : null
  const editing = edit ? state.models.find((model) => model.id === edit.modelId) : undefined
  const onEditsPage = edit !== null && routePart === edit.part && routeModel?.id === edit.modelId
  const unsaved = edit !== null && editing !== undefined && partHasChanges(editing, edit.part, edit.draft)
  const partShown = edit !== null && editing !== undefined && (onEditsPage || unsaved)

  useEffect(() => {
    if (edit && !partShown) dispatch({ type: 'editLeft' })
  }, [edit, partShown])

  // A part's page reached by its address alone, on a reload or by the browser's Forward, opens
  // with the model's answers.
  const partToOpen = !wizard && !edit && routePart && routeModel ? routeModel.id : null
  useEffect(() => {
    if (partToOpen && routePart) dispatch({ type: 'editOpened', modelId: partToOpen, part: routePart })
  }, [partToOpen, routePart])

  let screen
  if (!ready && route.name === 'openFiles') {
    screen = (
      <ComingNextScreen title={text.openFiles.title} body={text.openFiles.body} backLabel={text.backToConnect} />
    )
  } else if (!ready) {
    screen = (
      <ConnectScreen
        state={state}
        onConnect={() => void connect()}
        onTrySample={trySample}
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
  } else if (edit && editing && partShown) {
    screen = (
      <EditPartScreen
        edit={edit}
        model={editing}
        isCurrent={state.currentModelId === editing.id}
        models={state.models}
        baseFitting={state.radio.baseFitting}
        dispatch={dispatch}
        leaving={!onEditsPage}
        onKeepEditing={() => goTo(paths.editPart(editing.id, edit.part))}
        onLeave={() => dispatch({ type: 'editLeft' })}
      />
    )
  } else if (routeModel && route.name === 'editPart') {
    // The part is about to open, in the effect above.
    screen = null
  } else if (routeModel && route.name === 'rebind') {
    screen = <RebindScreen model={routeModel} />
  } else if (routeModel) {
    screen = (
      <EditScreen
        model={routeModel}
        isCurrent={state.currentModelId === routeModel.id}
        baseFitting={state.radio.baseFitting}
        notice={state.notice}
        dispatch={dispatch}
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
  } else if (card) {
    screen = (
      <CardModelsScreen
        reading={card}
        notice={state.notice}
        onNoticeDismissed={() => dispatch({ type: 'noticeDismissed' })}
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
      <Header
        connected={
          ready ? { modelCount: modelCountOf(state), maxModels: MT12.maxModels, sample: state.card === null } : undefined
        }
      />
      <main ref={main} className={styles.main} tabIndex={-1} data-opening-card={openingAtStart || undefined}>
        {screen}
      </main>
      <ReviewerPanel />
    </>
  )
}

export default App
