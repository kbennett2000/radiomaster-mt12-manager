import type { Card } from '../files/card.ts'
import type { FileToRead, FolderToRead } from '../platform/radioFolder.ts'

/** A folder that exists only in a test, and a note of every file in it that was opened. */
export interface MadeUpFolder {
  folder: FolderToRead
  /** The path of each file whose bytes were asked for, in the order they were asked for. */
  opened: string[]
}

interface Tree {
  folders: Map<string, Tree>
  files: Map<string, Uint8Array>
}

const emptyTree = (): Tree => ({ folders: new Map(), files: new Map() })

/**
 * For tests: a folder handle that was not picked by anyone, holding these files. It has the read
 * side of a real handle and nothing else, so code that tried to write to it would fail.
 * A path that ends in "/" makes a folder with nothing in it. `unreadable` names files whose bytes
 * cannot be had, as when a drive is pulled out part way through.
 */
export function folderHolding(files: Card, unreadable: readonly string[] = []): MadeUpFolder {
  const top = emptyTree()
  for (const [path, bytes] of files) {
    const names = path.split('/')
    const fileName = names.pop()!
    let tree = top
    for (const name of names) {
      if (!tree.folders.has(name)) tree.folders.set(name, emptyTree())
      tree = tree.folders.get(name)!
    }
    if (fileName !== '') tree.files.set(fileName, bytes)
  }

  const opened: string[] = []

  function fileAt(path: string, bytes: Uint8Array): FileToRead {
    return {
      kind: 'file',
      getFile: async () => {
        opened.push(path)
        if (unreadable.includes(path)) throw new Error(`${path} cannot be read`)
        return { arrayBuffer: async () => new Uint8Array(bytes).buffer }
      },
    }
  }

  function folderAt(tree: Tree, prefix: string): FolderToRead {
    return {
      kind: 'directory',
      async *entries() {
        for (const [name, inside] of tree.folders) yield [name, folderAt(inside, `${prefix}${name}/`)]
        for (const [name, bytes] of tree.files) yield [name, fileAt(`${prefix}${name}`, bytes)]
      },
    }
  }

  return { folder: folderAt(top, ''), opened }
}
