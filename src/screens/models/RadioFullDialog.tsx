import { Button } from '../../components/Button.tsx'
import { Dialog, DialogActions } from '../../components/Dialog.tsx'
import { MT12 } from '../../domain/catalog.ts'
import { strings } from '../../strings/en.ts'

/** Explains why a model cannot be added, copied or restored right now. */
export function RadioFullDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title={strings.radioFull.title} onDismiss={onClose}>
      <p>{strings.radioFull.body(MT12.maxModels)}</p>
      <DialogActions>
        <Button variant="primary" onClick={onClose} data-autofocus>
          {strings.radioFull.ok}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
