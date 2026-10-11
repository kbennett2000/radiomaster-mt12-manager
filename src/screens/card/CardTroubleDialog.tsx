import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { needsReadingAgain, type CardTrouble } from '../../state/cardState.ts'
import { strings } from '../../strings/en.ts'
import { refusalWords } from '../models/cardWords.ts'
import { RadioFullDialog } from '../models/RadioFullDialog.tsx'

const text = strings.card.trouble

interface CardTroubleDialogProps {
  trouble: CardTrouble
  /** Closes the dialog. The card is as the app holds it, so there is nothing else to do. */
  onClose: () => void
  /** Reads the folder afresh, for trouble that leaves the app not knowing what is on the card. */
  onReadAgain: () => void
}

/** What the trouble was, in plain words: what happened, whether the radio's files changed, and what to do. */
function wordsFor(trouble: CardTrouble): { title: string; body: string } {
  switch (trouble.kind) {
    case 'notAllowed':
      return { title: text.nothingChanged, body: text.notAllowed }
    case 'cardChanged':
      return { title: text.nothingChanged, body: text.cardChanged }
    case 'backupFailed':
      return { title: text.nothingChanged, body: text.backupFailed }
    case 'didNotFinish':
      return { title: text.didNotFinishTitle, body: text.didNotFinish }
    case 'refused':
      return { title: text.nothingChanged, body: refusalWords(trouble.problem) }
  }
}

/**
 * Says that a change was not made, over a screen that is left exactly as it was. There is one
 * thing to press. When the app can no longer be sure what is on the card, that one thing is
 * "Read the card again", and Escape does the same, so there is no way past it.
 */
export function CardTroubleDialog({ trouble, onClose, onReadAgain }: CardTroubleDialogProps) {
  // A full card is the one refusal the sample list has too, so it is said the same way.
  if (trouble.kind === 'refused' && trouble.problem === 'cardFull') return <RadioFullDialog onClose={onClose} />

  const { title, body } = wordsFor(trouble)
  const readAgain = needsReadingAgain(trouble)
  const press = readAgain ? onReadAgain : onClose

  return (
    <Dialog title={title} onDismiss={press}>
      <p>{body}</p>
      <DialogActions>
        <Button variant="primary" onClick={press} data-autofocus>
          {readAgain ? text.readAgain : text.ok}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
