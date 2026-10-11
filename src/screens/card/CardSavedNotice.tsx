import { Button } from '../../components/Button.tsx'
import { CloseIcon, UndoIcon } from '../../components/icons.tsx'
import { Notice } from '../../components/Notice.tsx'
import type { CardNotice } from '../../state/cardState.ts'
import { strings } from '../../strings/en.ts'
import { changeWords } from '../models/cardWords.ts'

interface CardSavedNoticeProps {
  notice: CardNotice
  onUndo: () => void
  onDismiss: () => void
}

/**
 * "Saved to your radio", after a change to a real card: what changed, in the sample list's own
 * words, with a way to undo it. The save that made the backup also says where the backup is.
 */
export function CardSavedNotice({ notice, onUndo, onDismiss }: CardSavedNoticeProps) {
  return (
    <Notice
      title={strings.notice.savedTitle}
      announceKey={notice}
      note={notice.backupMade ? strings.card.backupMade : undefined}
      actions={
        <>
          {notice.undo && (
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
      {changeWords(notice.change)}
    </Notice>
  )
}
