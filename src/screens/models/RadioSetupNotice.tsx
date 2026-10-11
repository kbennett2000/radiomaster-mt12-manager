import { Button } from '../../components/Button.tsx'
import { CloseIcon } from '../../components/icons.tsx'
import { Notice } from '../../components/Notice.tsx'
import { strings } from '../../strings/en.ts'

interface RadioSetupNoticeProps {
  /** Changes whenever there is a new message to announce. */
  announceKey: unknown
  onDismiss: () => void
}

/** Confirms that the answers on the Radio setup page were saved. They are the app's own, not the radio's. */
export function RadioSetupNotice({ announceKey, onDismiss }: RadioSetupNoticeProps) {
  return (
    <Notice
      title={strings.notice.radioSetupTitle}
      announceKey={announceKey}
      actions={
        <Button variant="quiet" icon={<CloseIcon />} onClick={onDismiss}>
          {strings.notice.dismiss}
        </Button>
      }
    >
      {strings.notice.radioSetupBody}
    </Notice>
  )
}
