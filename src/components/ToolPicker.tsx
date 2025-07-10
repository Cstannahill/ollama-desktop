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

  const basic = data?.filter((t) => t.name !== "shell_exec") || [];
  const exec = data?.find((t) => t.name === "shell_exec");

  const renderTool = (t: ToolMeta, label?: string) => (
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
      {label || t.name}
    </label>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {basic.map((t) => renderTool(t))}
      </div>
      {exec && (
        <div className="mt-2">
          <h4 className="text-sm font-bold mb-1">Advanced Tools</h4>
          {renderTool(exec, "⚠ shell_exec (risky)")}
        </div>
      )}
    </div>
  );
}
