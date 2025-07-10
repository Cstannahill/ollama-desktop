import { useState } from "react";
import { useThreadSettings } from "../stores/threadSettingsStore";

export default function AttachmentTile({ id, name }: { id: string; name: string }) {
  const { weights, setWeight } = useThreadSettings();
  const [val, setVal] = useState(weights[id] ?? 1);

  const onChange = (v: number) => {
    setVal(v);
    setWeight(id, v);
  };

  return (
    <div className="flex flex-col items-start text-xs">
      <span>📄 {name}</span>
      <label className="flex items-center gap-1">
        Importance
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={val}
          onChange={(e) => onChange(parseFloat(e.currentTarget.value))}
        />
        <span>{val.toFixed(1)}</span>
      </label>
    </div>
  );
}
