// A small hash router. The part of the address after "#" says which page is showing,
// so the static site needs no server rules and the browser's Back button works.

import { useMemo, useSyncExternalStore } from 'react'
import type { ModelId } from '../domain/model.ts'
import { EDIT_PARTS, type EditPart } from './edit.ts'
import { BUILT_STEPS, type BuiltStepId } from './wizard.ts'

export type Route =
  | { name: 'home' }
  | { name: 'addModel'; step: BuiltStepId }
  /** The wizard's last page, shown once the model has been added. */
  | { name: 'bind' }
  | { name: 'editModel'; modelId: ModelId }
  /** One part of a model, on a page of its own. */
  | { name: 'editPart'; modelId: ModelId; part: EditPart }
  /** How to bind the receiver again, after a model's receiver was changed. */
  | { name: 'rebind'; modelId: ModelId }
  | { name: 'radioSetup' }
  | { name: 'finish' }
  | { name: 'openFiles' }

/** The part of the address that names each wizard step. */
const stepSlugs: Record<BuiltStepId, string> = {
  name: 'name',
  receiver: 'receiver',
  steeringThrottle: 'steering-throttle',
  extras: 'extras',
  feedback: 'feedback',
  review: 'review',
}

export const paths = {
  home: '#/',
  /** Each step of the "Add a model" wizard has its own address, so the browser's Back steps through them. */
  addStep: (step: BuiltStepId) => `#/models/add/${stepSlugs[step]}`,
  bind: '#/models/add/bind',
  editModel: (modelId: ModelId) => `#/models/${encodeURIComponent(modelId)}/edit`,
  /** Each part of a model has its own address too, so the browser's Back leaves it like any other page. */
  editPart: (modelId: ModelId, part: EditPart) => `#/models/${encodeURIComponent(modelId)}/edit/${stepSlugs[part]}`,
  rebind: (modelId: ModelId) => `#/models/${encodeURIComponent(modelId)}/bind`,
  radioSetup: '#/radio-setup',
  finish: '#/finish',
  openFiles: '#/open-files',
}

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '')
  if (path === '/models/add/bind') return { name: 'bind' }
  const add = /^\/models\/add(?:\/([^/]*))?$/.exec(path)
  if (add) return { name: 'addModel', step: BUILT_STEPS.find((step) => stepSlugs[step] === add[1]) ?? 'name' }
  if (path === '/radio-setup') return { name: 'radioSetup' }
  if (path === '/finish') return { name: 'finish' }
  if (path === '/open-files') return { name: 'openFiles' }
  const rebind = /^\/models\/([^/]+)\/bind$/.exec(path)
  if (rebind) return { name: 'rebind', modelId: decodeURIComponent(rebind[1]) }
  const edit = /^\/models\/([^/]+)\/edit(?:\/([^/]*))?$/.exec(path)
  if (edit) {
    const modelId = decodeURIComponent(edit[1])
    const part = EDIT_PARTS.find((candidate) => stepSlugs[candidate] === edit[2])
    return part ? { name: 'editPart', modelId, part } : { name: 'editModel', modelId }
  }
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
