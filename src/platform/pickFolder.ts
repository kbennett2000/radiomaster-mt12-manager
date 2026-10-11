// The browser's own folder picker, asked for one thing only: to read a folder.

declare global {
  interface Window {
    /**
     * Opens the browser's folder picker. Only some browsers have it. The app asks to read and
     * nothing more, so "read" is the only mode this declaration allows.
     */
    showDirectoryPicker?: (options: { mode: 'read' }) => Promise<FileSystemDirectoryHandle>
  }
}

/**
 * Asks the person to pick their radio's drive, for reading only. Gives null when no folder comes
 * back: the picker was closed without choosing, or the browser would not open it.
 */
export async function pickFolderToRead(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null
  try {
    return await window.showDirectoryPicker({ mode: 'read' })
  } catch {
    return null
  }
}
