import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chatStore";
import { usePermissionStore } from "../stores/permissionStore";

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

  return (
    <div className="flex items-center gap-2">
      {data?.map((t) => (
        <label key={t.name} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={enabledTools.includes(t.name)}
            onChange={() => {
              if (
                enabledTools.includes(t.name) ||
                allowedToolsByThread[currentThreadId]?.includes(t.name)
              ) {
                toggleTool(t.name);
                mutate();
              } else {
                requestPermission(t.name);
              }
            }}
          />
          {t.name}
        </label>
      ))}
    </div>
  );
}
