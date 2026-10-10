import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// The test browser cannot open modal dialogs, so give <dialog> the two methods the app calls.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.open = false
}

afterEach(() => {
  cleanup()
  window.location.hash = ''
})
