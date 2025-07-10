import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppConfig } from "../stores/appConfig";

// TODO: cloud-deployed Ollama auth (JWT / mTLS)

const HOST_RE = /^https?:\/\/[a-zA-Z0-9._:-]+$/;

export default function ServerSettingsModal({ onClose }: { onClose: () => void }) {
  const { host, port, token, setHost, setPort, setToken } = useAppConfig();
  const [h, setH] = useState(host);
  const [p, setP] = useState(port);
  const [t, setT] = useState(token);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setHost(h);
    setPort(p);
    setToken(t);
    await invoke("set_server_settings", { host: h, port: p, token: t || null });
    onClose();
  };

  const test = async () => {
    setMsg(null);
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 3000);
      const url = `${h.replace(/\/$/, "")}:${p}/api/tags`;
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: t ? { Authorization: `Bearer ${t}` } : undefined,
      });
      clearTimeout(id);
      if (res.ok) setMsg("Connection OK");
      else setMsg("Connection failed");
    } catch {
      setMsg("Connection failed");
    }
    setTimeout(() => setMsg(null), 2000);
  };

  const valid = HOST_RE.test(h);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded space-y-2 w-64">
        <h2 className="font-bold">Server Settings</h2>
        <label className="flex flex-col text-sm">
          Host
          <input className="border p-1" value={h} onChange={(e) => setH(e.currentTarget.value)} />
        </label>
        <label className="flex flex-col text-sm">
          Port
          <input type="number" className="border p-1" value={p} onChange={(e) => setP(parseInt(e.currentTarget.value))} />
        </label>
        <label className="flex flex-col text-sm">
          Bearer Token
          <input className="border p-1" value={t} onChange={(e) => setT(e.currentTarget.value)} />
        </label>
        <div className="flex items-center gap-2">
          <button className="border px-2" onClick={test} disabled={!valid}>Test Connection</button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
        <div className="flex justify-end gap-2">
          <button className="border px-2" onClick={onClose}>Cancel</button>
          <button className="border px-2" onClick={save} disabled={!valid}>Save</button>
        </div>
      </div>
    </div>
  );
}
