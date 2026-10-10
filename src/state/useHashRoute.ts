// A small hash router. The part of the address after "#" says which page is showing,
// so the static site needs no server rules and the browser's Back button works.

import { useMemo, useSyncExternalStore } from 'react'
import type { ModelId } from '../domain/model.ts'
import { BUILT_STEPS, type BuiltStepId } from './wizard.ts'

export type Route =
  | { name: 'home' }
  | { name: 'addModel'; step: BuiltStepId }
  | { name: 'editModel'; modelId: ModelId }
  | { name: 'radioSetup' }
  | { name: 'finish' }
  | { name: 'openFiles' }

/** The part of the address that names each wizard step. */
const stepSlugs: Record<BuiltStepId, string> = {
  name: 'name',
  receiver: 'receiver',
  steeringThrottle: 'steering-throttle',
  extras: 'extras',
  review: 'review',
}

export const paths = {
  home: '#/',
  /** Each step of the "Add a model" wizard has its own address, so the browser's Back steps through them. */
  addStep: (step: BuiltStepId) => `#/models/add/${stepSlugs[step]}`,
  editModel: (modelId: ModelId) => `#/models/${encodeURIComponent(modelId)}/edit`,
  radioSetup: '#/radio-setup',
  finish: '#/finish',
  openFiles: '#/open-files',
}

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '')
  const add = /^\/models\/add(?:\/([^/]*))?$/.exec(path)
  if (add) return { name: 'addModel', step: BUILT_STEPS.find((step) => stepSlugs[step] === add[1]) ?? 'name' }
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

/** Goes to a page without leaving the current one in the browser's history. */
export function redirectTo(path: string): void {
  window.location.replace(path)
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
