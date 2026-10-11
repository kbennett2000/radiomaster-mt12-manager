import { useEffect, type Dispatch } from 'react'
import { SavingCover } from '../../components/SavingCover.tsx'
import type { WhenDeleting } from '../../domain/positions.ts'
import { checkModelName } from '../../domain/modelName.ts'
import type { Action, Notice } from '../../state/appState.ts'
import type { CardState } from '../../state/cardState.ts'
import { goTo, paths, redirectTo, type Route } from '../../state/useHashRoute.ts'
import { CardEditScreen } from '../editModel/CardEditScreen.tsx'
import { CardNameScreen } from '../editModel/CardNameScreen.tsx'
import { CardModelsScreen } from '../models/CardModelsScreen.tsx'
import { isRename, renamedPosition } from '../models/cardWords.ts'
import { placeRowId } from '../models/rowId.ts'
import { CardTroubleDialog } from './CardTroubleDialog.tsx'
import type { CardActions } from './useCardActions.ts'

interface CardScreensProps {
  /** The real card and what is going on with it. */
  card: CardState
  route: Route
  /** What a delete does to the rest of the list. Chosen in Radio setup. */
  whenDeleting: WhenDeleting
  /** The confirmation that Radio setup was saved, when that is the last thing that happened. */
  notice: Notice | null
  dispatch: Dispatch<Action>
  actions: CardActions
}

/**
 * Every page about a real card: the list, the short Edit page for one model and its name page.
 * Over whichever is showing go the cover while a save runs, and the dialog when one was not made.
 */
export function CardScreens({ card, route, whenDeleting, notice, dispatch, actions }: CardScreensProps) {
  const { perform, readAgain } = actions
  const { models, currentPosition } = card.reading

  // The address names a model by its place. Only a model whose file was read has pages of its own.
  const aboutAModel = route.name === 'editModel' || route.name === 'editPart' || route.name === 'rebind'
  const routeModel = aboutAModel ? models.find((model) => placeRowId(model.position) === route.modelId) : undefined
  const editable = routeModel && routeModel.name !== null ? routeModel : undefined
  const onNamePage = route.name === 'editPart' && route.part === 'name'

  // The name page while it is open. If the address moves off it, by Cancel, a header link or the
  // browser's Back, that is the person leaving. With a change not yet saved the page stays and
  // asks first. With none, it just closes. This is how a sample model's name page behaves too.
  const edit = card.edit
  const editing = edit ? models.find((model) => model.position === edit.position && model.name !== null) : undefined
  const onEditsPage = edit !== null && onNamePage && editable?.position === edit.position
  const unsaved = edit !== null && editing !== undefined && edit.name.trim() !== editing.name
  const nameShown = edit !== null && editing !== undefined && (onEditsPage || unsaved)

  useEffect(() => {
    if (edit && !nameShown) dispatch({ type: 'cardEditClosed' })
  }, [edit, nameShown, dispatch])

  // The name page reached by its address alone, on a reload or by the browser's Forward, opens
  // with the model's name.
  const nameToOpen = !edit && onNamePage && editable ? editable.position : null
  useEffect(() => {
    if (nameToOpen !== null) dispatch({ type: 'cardEditOpened', position: nameToOpen })
  }, [nameToOpen, dispatch])

  // An address for a page a real card does not have goes to the nearest one it does have.
  const noSuchPage = aboutAModel && !nameShown && (!editable || (route.name !== 'editModel' && !onNamePage))
  const nearest = noSuchPage && editable ? paths.editModel(placeRowId(editable.position)) : paths.home
  useEffect(() => {
    if (noSuchPage) redirectTo(nearest)
  }, [noSuchPage, nearest])

  let page
  if (edit && editing && nameShown) {
    const id = placeRowId(editing.position)
    const others = models.flatMap((model) => (model.position !== editing.position && model.name !== null ? [model.name] : []))
    page = (
      <CardNameScreen
        edit={edit}
        model={editing}
        isCurrent={editing.position === currentPosition}
        namesInUse={others}
        leaving={!onEditsPage}
        onChange={(name) => dispatch({ type: 'cardEditChanged', name })}
        onSave={() => {
          if (checkModelName(edit.name, others, { plainOnly: true })) {
            dispatch({ type: 'cardEditTried' })
          } else if (!unsaved) {
            // Saving with nothing changed just closes the page.
            goTo(paths.editModel(id))
            dispatch({ type: 'cardEditClosed' })
          } else {
            // The address moves on once the save has ended well, just before the page is told.
            void perform({ kind: 'rename', position: editing.position, name: edit.name }, card, () => goTo(paths.editModel(id)))
          }
        }}
        onKeepEditing={() => goTo(paths.editPart(id, 'name'))}
        onLeave={() => dispatch({ type: 'cardEditClosed' })}
      />
    )
  } else if (editable && route.name === 'editModel') {
    const last = card.notice
    page = (
      <CardEditScreen
        model={editable}
        isCurrent={editable.position === currentPosition}
        notice={last && isRename(last.change) && renamedPosition(last.change) === editable.position ? last : null}
        onChangeName={() => dispatch({ type: 'cardEditOpened', position: editable.position })}
        onUndo={() => void perform({ kind: 'undo' }, card)}
        onNoticeDismissed={() => dispatch({ type: 'cardNoticeDismissed' })}
      />
    )
  } else if (aboutAModel) {
    // The name page is about to open, or the address is about to change, in the effects above.
    page = null
  } else {
    page = <CardModelsScreen card={card} whenDeleting={whenDeleting} notice={notice} dispatch={dispatch} perform={perform} />
  }

  return (
    <>
      {page}
      {card.saving && <SavingCover />}
      {card.trouble && !card.saving && (
        <CardTroubleDialog
          trouble={card.trouble}
          onClose={() => dispatch({ type: 'cardTroubleDismissed' })}
          onReadAgain={() => void readAgain()}
        />
      )}
    </>
  )
}
