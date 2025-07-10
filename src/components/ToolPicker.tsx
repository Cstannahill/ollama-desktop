// ToolPicker.tsx
import React, { useCallback } from 'react'
import { useTools } from '@/hooks/useTools'
import { useChatStore } from '../stores/chatStore'
import { usePermissionStore } from '../stores/permissionStore'
import { ToolMeta } from '@/hooks/useTools'

function ToolCheckbox({
  tool,
  label,
  onToggle,
  isChecked,
}: {
  tool: ToolMeta
  label?: string
  onToggle: (name: string) => void
  isChecked: boolean
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => onToggle(tool.name)}
        className="form-checkbox h-4 w-4"
      />
      <span className="select-none">{label ?? tool.name}</span>
    </label>
  )
}

export default function ToolPicker() {
  const { data: tools, error, isLoading, mutate } = useTools()
  const { enabledTools, toggleTool } = useChatStore()
  const { requestPermission, allowedToolsByThread, currentThreadId } =
    usePermissionStore()

  const handleToggle = useCallback(
    (name: string) => {
      const isEnabled = enabledTools.includes(name)
      const isAllowed = allowedToolsByThread[currentThreadId]?.includes(name)

      if (isEnabled || isAllowed) {
        toggleTool(name)
        mutate() // refresh tool list or states if needed
      } else {
        requestPermission(name)
      }
    },
    [enabledTools, allowedToolsByThread, currentThreadId, toggleTool, requestPermission, mutate]
  )

  if (isLoading) {
    return <div className="py-4 text-center text-sm text-gray-500">Loading tools…</div>
  }

  if (error) {
    return <div className="py-4 text-center text-sm text-red-600">Failed to load tools</div>
  }

  const basicTools = tools!.filter((t) => t.name !== 'shell_exec')
  const execTool = tools!.find((t) => t.name === 'shell_exec')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {basicTools.map((tool) => (
          <ToolCheckbox
            key={tool.name}
            tool={tool}
            isChecked={enabledTools.includes(tool.name)}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {execTool && (
        <div className="pt-4 border-t">
          <h4 className="text-sm font-bold mb-2">Advanced Tools</h4>
          <ToolCheckbox
            tool={execTool}
            label="⚠ shell_exec (risky)"
            isChecked={enabledTools.includes(execTool.name)}
            onToggle={handleToggle}
          />
        </div>
      )}
    </div>
  )
}
