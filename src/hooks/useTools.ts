// useTools.ts
import useSWR from 'swr'
import { invoke } from '@tauri-apps/api/core'

export type ToolMeta = { name: string; description: string; json_schema: any }

export function useTools() {
  const { data, error, isLoading, mutate } = useSWR<ToolMeta[]>(
    'tools',
    () => invoke('list_tools') as Promise<ToolMeta[]>,
    {
      revalidateOnFocus: false,
      errorRetryCount: 1,
    }
  )

  return { data, error, isLoading, mutate }
}
