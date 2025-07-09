import { useEffect } from "react";
import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chatStore";

const fetcher = () => invoke<string[]>("list_models");

export default function ModelPicker() {
  const { data: models } = useSWR("models", fetcher);
  const { currentModel, setModel } = useChatStore();

  useEffect(() => {
    if (models && models.length > 0 && !currentModel) {
      setModel(models[0]);
    }
  }, [models, currentModel, setModel]);

  if (!models) return <div>Loading models...</div>;
  if (models.length === 0)
    return <div>No models found. Start Ollama.</div>;

  return (
    <select
      className="border rounded p-1"
      value={currentModel}
      onChange={(e) => setModel(e.target.value)}
    >
      {models.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
