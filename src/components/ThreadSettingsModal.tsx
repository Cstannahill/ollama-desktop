import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThreadSettings } from "../stores/threadSettingsStore";

export default function ThreadSettingsModal({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const { topK, ctxTokens, setTopK, setCtxTokens } = useThreadSettings();
  const [k, setK] = useState(topK);
  const [ctx, setCtx] = useState(ctxTokens);

  const save = async () => {
    setTopK(k);
    setCtxTokens(ctx);
    await invoke("update_thread_settings", { threadId, topK: k, ctxTokens: ctx });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white p-4 rounded space-y-2 w-64">
        <h2 className="font-bold">Thread Settings</h2>
        <label className="flex flex-col text-sm">
          Top K
          <input
            type="number"
            min={1}
            max={10}
            value={k}
            onChange={(e) => setK(parseInt(e.currentTarget.value))}
            className="border p-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          Context Tokens
          <input
            type="number"
            min={512}
            max={4096}
            value={ctx}
            onChange={(e) => setCtx(parseInt(e.currentTarget.value))}
            className="border p-1"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button className="border px-2" onClick={onClose}>Cancel</button>
          <button className="border px-2" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
