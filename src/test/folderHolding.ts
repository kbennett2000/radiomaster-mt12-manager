import type { Card } from '../files/card.ts'
import type { FileToChange, FolderToChange } from '../platform/saveToFolder.ts'

/** Something done to a made-up folder that a test can make fail. */
export interface Attempt {
  /** 'write' is the moment a file's new bytes take the old ones' place. 'make' is making a folder. */
  kind: 'write' | 'remove' | 'make'
  /** The path of the file or folder, from the top of the made-up folder. */
  path: string
}

/** A folder that exists only in a test. */
export interface MadeUpFolder {
  /** The handle to give to the code being tested. It has the read side and the write side of a real one. */
  folder: FolderToChange
  /** The path of each file whose bytes were asked for, in the order they were asked for. */
  opened: string[]
  /** Everything that was done to the folder, in order: "ask", "make A/", "write A/b", "remove A/b". */
  log: string[]
  /** Every file in the folder as it stands now. */
  files(): Card
  /** Every folder in it as it stands now, each ending in "/". */
  folders(): string[]
  /** Changes a file from outside, the way another program would. It is not put in the log. */
  put(path: string, bytes: Uint8Array): void
  /** What the browser says when it is asked whether files may be changed. 'error' makes the asking itself fail. */
  permission: PermissionState | 'error'
  /** Set this to make something fail: return true for the attempt that should. */
  fails: (attempt: Attempt) => boolean
  /** Set this to make a file come out wrong: what is kept in place of the bytes that were written. */
  garbles: (path: string, bytes: Uint8Array) => Uint8Array
}

interface Tree {
  folders: Map<string, Tree>
  files: Map<string, Uint8Array>
}

const emptyTree = (): Tree => ({ folders: new Map(), files: new Map() })

/** The errors a real handle gives, by the names the browser gives them. */
const problem = (name: 'NotFoundError' | 'TypeMismatchError' | 'InvalidModificationError', about: string): DOMException =>
  new DOMException(`${about}: ${name}`, name)

/**
 * For tests: a folder handle that was not picked by anyone, holding these files. Everything is
 * kept in memory, so nothing a test does can reach a real folder. A path that ends in "/" makes a
 * folder with nothing in it. `unreadable` names files whose bytes cannot be had, as when a drive
 * is pulled out part way through.
 */
export function folderHolding(files: Card, unreadable: readonly string[] = []): MadeUpFolder {
  const top = emptyTree()

  function treeAt(folderNames: readonly string[], make: boolean): Tree | undefined {
    let tree: Tree | undefined = top
    for (const name of folderNames) {
      if (make && !tree.folders.has(name)) tree.folders.set(name, emptyTree())
      tree = tree.folders.get(name)
      if (!tree) return undefined
    }
    return tree
  }
  function put(path: string, bytes: Uint8Array) {
    const names = path.split('/')
    const fileName = names.pop()!
    const tree = treeAt(names, true)!
    if (fileName !== '') tree.files.set(fileName, bytes)
  }
  for (const [path, bytes] of files) put(path, bytes)

  const made: MadeUpFolder = {
    folder: folderAt(top, ''),
    opened: [],
    log: [],
    files: () => new Map(listed(top, '')),
    folders: () => foldersIn(top, ''),
    put,
    permission: 'granted',
    fails: () => false,
    garbles: (_path, bytes) => bytes,
  }

  function listed(tree: Tree, prefix: string): [string, Uint8Array][] {
    return [
      ...Array.from(tree.files, ([name, bytes]): [string, Uint8Array] => [`${prefix}${name}`, bytes]),
      ...Array.from(tree.folders).flatMap(([name, inside]) => listed(inside, `${prefix}${name}/`)),
    ]
  }
  function foldersIn(tree: Tree, prefix: string): string[] {
    return Array.from(tree.folders).flatMap(([name, inside]) => [`${prefix}${name}/`, ...foldersIn(inside, `${prefix}${name}/`)])
  }
  function attempt(kind: Attempt['kind'], path: string) {
    if (made.fails({ kind, path })) throw new Error(`${kind} ${path} was made to fail`)
    made.log.push(`${kind} ${path}`)
  }

  function fileAt(tree: Tree, name: string, path: string): FileToChange {
    return {
      kind: 'file',
      getFile: async () => {
        const bytes = tree.files.get(name)
        if (!bytes) throw problem('NotFoundError', path)
        made.opened.push(path)
        if (unreadable.includes(path)) throw new Error(`${path} cannot be read`)
        return { arrayBuffer: async () => new Uint8Array(bytes).buffer }
      },
      // As in the browser, the new bytes take the old ones' place all at once, when the writing is closed.
      createWritable: async () => {
        let written = new Uint8Array()
        return {
          write: async (data) => {
            written = new Uint8Array(data)
          },
          close: async () => {
            attempt('write', path)
            tree.files.set(name, made.garbles(path, written))
          },
        }
      },
    }
  }

  function folderAt(tree: Tree, prefix: string): FolderToChange {
    return {
      kind: 'directory',
      async *entries() {
        for (const [name, inside] of Array.from(tree.folders)) yield [name, folderAt(inside, `${prefix}${name}/`)]
        for (const name of Array.from(tree.files.keys())) yield [name, fileAt(tree, name, `${prefix}${name}`)]
      },
      requestPermission: async () => {
        made.log.push('ask')
        if (made.permission === 'error') throw new Error('the browser would not ask')
        return made.permission
      },
      getDirectoryHandle: async (name, options) => {
        if (tree.files.has(name)) throw problem('TypeMismatchError', `${prefix}${name}`)
        if (!tree.folders.has(name)) {
          if (!options?.create) throw problem('NotFoundError', `${prefix}${name}`)
          attempt('make', `${prefix}${name}/`)
          tree.folders.set(name, emptyTree())
        }
        return folderAt(tree.folders.get(name)!, `${prefix}${name}/`)
      },
      getFileHandle: async (name, options) => {
        if (tree.folders.has(name)) throw problem('TypeMismatchError', `${prefix}${name}`)
        if (!tree.files.has(name)) {
          if (!options?.create) throw problem('NotFoundError', `${prefix}${name}`)
          // As in the browser, asking for a file that is not there makes an empty one at once,
          // before anything is written to it.
          tree.files.set(name, new Uint8Array())
        }
        return fileAt(tree, name, `${prefix}${name}`)
      },
      removeEntry: async (name, options) => {
        const inside = tree.folders.get(name)
        if (!inside && !tree.files.has(name)) throw problem('NotFoundError', `${prefix}${name}`)
        if (inside && !options?.recursive && inside.folders.size + inside.files.size > 0) {
          throw problem('InvalidModificationError', `${prefix}${name}`)
        }
        attempt('remove', `${prefix}${name}${inside ? '/' : ''}`)
        tree.folders.delete(name)
        tree.files.delete(name)
      },
    }
  }

  return made
}
