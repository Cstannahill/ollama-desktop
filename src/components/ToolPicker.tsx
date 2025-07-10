"use client"

import useSWR from "swr"
import { invoke } from "@tauri-apps/api/core"
import { ScrollArea, Separator, Switch } from "@/components/ui"
import { useChatStore } from "../stores/chatStore"
import { usePermissionStore } from "../stores/permissionStore"

export type ToolMeta = {
  name: string
  description: string
  json_schema: any
}

export default function ToolPicker() {
  const { enabledTools, toggleTool } = useChatStore()
  const { requestPermission, allowedToolsByThread, currentThreadId } =
    usePermissionStore()
  const {
    data: tools,
    error,
    isValidating: isLoading,
    mutate,
  } = useSWR<ToolMeta[]>("tools", () => invoke("list_tools") as Promise<ToolMeta[]>)

  if (isLoading) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">Loading tools…</div>
    )
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-red-600">Failed to load tools</div>
    )
  }

  const basicTools = tools!.filter((t) => t.name !== "shell_exec")
  const execTool = tools!.find((t) => t.name === "shell_exec")

  const handleToggle = (t: ToolMeta) => (checked: boolean) => {
    const isAllowed = allowedToolsByThread[currentThreadId]?.includes(t.name)
    const isEnabled = enabledTools.includes(t.name)

    if (isEnabled || isAllowed) {
      toggleTool(t.name)
      mutate()
    } else {
      requestPermission(t.name)
    }
  }

  const renderSwitch = (t: ToolMeta, label?: string) => {
    const isChecked = enabledTools.includes(t.name)
    const isDisabled =
      !isChecked && !allowedToolsByThread[currentThreadId]?.includes(t.name)

    return (
      <div key={t.name} className="flex items-center justify-between gap-2">
        <span>{label || t.name}</span>
        <Switch
          checked={isChecked}
          disabled={isDisabled}
          onCheckedChange={handleToggle(t)}
        />
      </div>
    )
  }

  return (
    <ScrollArea className="h-48 w-full pr-2">
      <div className="flex flex-col gap-2 p-1">
        {basicTools.map((t) => renderSwitch(t))}
        {execTool && (
          <>
            <Separator className="my-2" />
            <div>
              <h4 className="mb-1 text-sm font-bold">Advanced Tools</h4>
              {renderSwitch(execTool, "⚠ shell_exec (risky)")}
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  )
}
