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


export default function ToolPicker() {
  const { enabledTools, toggleTool } = useChatStore();
  const { requestPermission, allowedToolsByThread, currentThreadId } =
    usePermissionStore();
  const { data, mutate } = useSWR<ToolMeta[]>(
    "tools",
    () => invoke("list_tools") as Promise<ToolMeta[]>
  );

  const basic = data?.filter((t) => t.name !== "shell_exec") || [];
  const exec = data?.find((t) => t.name === "shell_exec");

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
  )
}
