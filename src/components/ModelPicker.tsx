import { useEffect } from "react";
import { toast } from 'sonner'
import useSWR from "swr";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chatStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";

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
    <Select
      value={currentModel}
      onValueChange={(value) => {
        setModel(value)
        toast('Model switched')
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m} value={m}>
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
