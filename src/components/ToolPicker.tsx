
import useSWR from "swr"
import { invoke } from "@tauri-apps/api/core"
import { ScrollArea, Separator, Switch } from '@/components/ui'
import { useChatStore } from "../stores/chatStore"
import { usePermissionStore } from "../stores/permissionStore"

export type ToolMeta = {
  name: string;
  description: string;
  json_schema: any;
};


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

  const renderTool = (t: ToolMeta, label?: string) => (
    <div key={t.name} className="flex items-center justify-between gap-2">
      <span>{label || t.name}</span>
      <Switch
        checked={enabledTools.includes(t.name)}
        onCheckedChange={() => {
          if (
            enabledTools.includes(t.name) ||
            allowedToolsByThread[currentThreadId]?.includes(t.name)
          ) {
            toggleTool(t.name)
            mutate()
          } else {
            requestPermission(t.name)
          }
        }}
      />
    </div>
  )

  return (
    <ScrollArea className="h-48 w-full pr-2">
      <div className="flex flex-col gap-2 p-1">
        {basic.map((t) => renderTool(t))}
        {exec && (
          <>
            <Separator className="my-2" />
            <div>
              <h4 className="text-sm font-bold mb-1">Advanced Tools</h4>
              {renderTool(exec, "⚠ shell_exec (risky)")}
            </div>
          </>
        )}
      </div>
    </ScrollArea>

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
