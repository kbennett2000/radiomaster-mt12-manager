import { useEffect, useRef } from 'react'
import { strings } from '../strings/en.ts'
import dialogStyles from './Dialog.module.css'
import { SpinnerIcon } from './icons.tsx'
import styles from './SavingCover.module.css'

/**
 * Shown while a change is being saved to the radio's card. It is a modal dialog with nothing to
 * press, so nothing else on the page can be clicked or reached by keyboard until the save ends.
 * Escape does not close it.
 */
export function SavingCover() {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    let ending = false
    // A browser may close a dialog on a second Escape whatever the page says. Open it again.
    const reopen = () => {
      if (!ending && dialog.isConnected) dialog.showModal()
    }
    dialog.addEventListener('close', reopen)
    if (!dialog.open) dialog.showModal()
    return () => {
      ending = true
      dialog.removeEventListener('close', reopen)
      dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className={`${dialogStyles.dialog} ${styles.cover}`}
      aria-label={strings.card.saving}
      onCancel={(event) => event.preventDefault()}
    >
      <SpinnerIcon />
      <p role="status">{strings.card.saving}</p>
    </dialog>
  )
}
