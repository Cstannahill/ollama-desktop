import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chatStore";

export type ToolMeta = {
  name: string;
  description: string;
  json_schema: any;
};

// TODO: per-thread tool-permission modal

export default function ToolPicker() {
  const { enabledTools, toggleTool } = useChatStore();
  const { data, mutate } = useSWR<ToolMeta[]>("tools", () => invoke("list_tools"));

  return (
    <div className="flex items-center gap-2">
      {data?.map((t) => (
        <label key={t.name} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={enabledTools.includes(t.name)}
            onChange={() => {
              toggleTool(t.name);
              mutate();
            }}
          />
          {t.name}
        </label>
      ))}
    </div>
  );
}
