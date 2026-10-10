// A small hash router. The part of the address after "#" says which page is showing,
// so the static site needs no server rules and the browser's Back button works.

import { useMemo, useSyncExternalStore } from 'react'
import type { ModelId } from '../domain/model.ts'

export type Route =
  | { name: 'home' }
  | { name: 'addModel' }
  | { name: 'editModel'; modelId: ModelId }
  | { name: 'radioSetup' }
  | { name: 'finish' }
  | { name: 'openFiles' }

export const paths = {
  home: '#/',
  addModel: '#/models/add',
  editModel: (modelId: ModelId) => `#/models/${encodeURIComponent(modelId)}/edit`,
  radioSetup: '#/radio-setup',
  finish: '#/finish',
  openFiles: '#/open-files',
}

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '')
  if (path === '/models/add') return { name: 'addModel' }
  if (path === '/radio-setup') return { name: 'radioSetup' }
  if (path === '/finish') return { name: 'finish' }
  if (path === '/open-files') return { name: 'openFiles' }
  const edit = /^\/models\/([^/]+)\/edit$/.exec(path)
  if (edit) return { name: 'editModel', modelId: decodeURIComponent(edit[1]) }
  return { name: 'home' }
}

export function goTo(path: string): void {
  window.location.hash = path
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const currentHash = (): string => window.location.hash

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, currentHash)
  return useMemo(() => parseRoute(hash), [hash])
}
