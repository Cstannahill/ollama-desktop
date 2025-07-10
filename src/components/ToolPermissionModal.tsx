import React from "react";
import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { usePermissionStore } from "../stores/permissionStore";
import { ToolMeta } from "./ToolPicker";

export default function ToolPermissionModal() {
  const { pendingTool, grantPermission, denyPermission } = usePermissionStore();
  const { data } = useSWR<ToolMeta[]>("tools", () => invoke("list_tools") as Promise<ToolMeta[]>);
  const tool = data?.find((t) => t.name === pendingTool);
  const [ack, setAck] = React.useState(false);
  if (!pendingTool) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded shadow w-80">
        <h2 className="font-bold mb-2">Allow tool: {pendingTool}</h2>
        <p className="mb-2 text-sm">{tool?.description}</p>
        <p className="text-sm mb-4">
          This tool can read or write files on your machine inside the workspace directory.
        </p>
        {pendingTool === "shell_exec" && (
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            I understand this can execute local programs.
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="border rounded px-3"
            onClick={() => grantPermission(pendingTool)}
            disabled={pendingTool === "shell_exec" && !ack}
          >
            Allow
          </button>
          <button className="border rounded px-3" onClick={denyPermission}>
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
