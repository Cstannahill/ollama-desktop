import { useHotkeys as useHook } from 'react-hotkeys-hook'
import { DependencyList } from 'react'

/**
 * Wrapper around react-hotkeys-hook with sensible defaults.
 */
export function useHotkeys(keys: string | string[], callback: () => void, deps: DependencyList) {
  useHook(keys, callback, { enableOnFormTags: ['textarea', 'input'] }, deps)
}
