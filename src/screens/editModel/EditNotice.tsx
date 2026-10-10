import { Button } from '../../components/Button.tsx'
import { CloseIcon, UndoIcon } from '../../components/icons.tsx'
import { Notice } from '../../components/Notice.tsx'
import type { EditChange } from '../../state/appState.ts'
import { extrasChangedBetween } from '../../state/edit.ts'
import { paths } from '../../state/useHashRoute.ts'
import { strings } from '../../strings/en.ts'
import { extraName } from '../addModel/describe.ts'

const text = strings.editModel.saved

/** What was changed, in one plain sentence. */
function words(notice: EditChange): string {
  if (notice.kind === 'editUndone') return text.undone(notice.modelName)
  const { was, now } = notice
  switch (notice.part) {
    case 'name':
      return text.renamed(was.name, now.name)
    case 'receiver':
      return text.receiver(now.name, strings.receiverTypes[now.receiverTypeId])
    case 'steeringThrottle':
      return text.steeringThrottle(now.name)
    case 'feedback':
      return text.feedback(now.name)
    case 'extras': {
      const { added, removed, changed } = extrasChangedBetween(was, now)
      return text.extras(now.name, added.map(extraName), removed.map(extraName), changed.map(extraName))
    }
  }
}

interface EditNoticeProps {
  notice: EditChange
  onUndo: () => void
  onDismiss: () => void
}

/**
 * "Saved to your radio", after one part of a model was changed: what changed, with a way to undo
 * it. A model whose receiver changed has to be bound again, so that notice says so and shows how.
 */
export function EditNotice({ notice, onUndo, onDismiss }: EditNoticeProps) {
  const receiverChanged = notice.kind === 'edited' && notice.part === 'receiver'
  return (
    <Notice
      title={strings.notice.savedTitle}
      announceKey={notice}
      actions={
        <>
          {notice.kind === 'edited' && (
            <Button icon={<UndoIcon />} onClick={onUndo}>
              {strings.notice.undo}
            </Button>
          )}
          <Button variant="quiet" icon={<CloseIcon />} onClick={onDismiss}>
            {strings.notice.dismiss}
          </Button>
        </>
      }
    >
      {words(notice)}
      {receiverChanged && (
        <>
          {' '}
          {text.bindAgain} <a href={paths.rebind(notice.modelId)}>{text.showMeHow}</a>
        </>
      )}
    </Notice>
  )
}
