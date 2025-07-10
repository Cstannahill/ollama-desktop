import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppConfig } from "../stores/appConfig";

// TODO: cloud-deployed Ollama auth (JWT / mTLS)

const HOST_RE = /^https?:\/\/[a-zA-Z0-9._:-]+$/;

export default function ServerSettingsModal({ onClose }: { onClose: () => void }) {
  const {
    host,
    port,
    token,
    mtls,
    cert,
    key,
    ca,
    push,
    setHost,
    setPort,
    setToken,
    setMtls,
    setCert,
    setKey,
    setCa,
    setPush,
  } = useAppConfig();
  const [h, setH] = useState(host);
  const [p, setP] = useState(port);
  const [t, setT] = useState(token);
  const [m, setM] = useState(mtls);
  const [c, setC] = useState(cert);
  const [k, setK] = useState(key);
  const [caPath, setCaPath] = useState(ca);
  const [reqJwt, setReqJwt] = useState(false);
  const [pushNotif, setPushLocal] = useState(push);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setHost(h);
    setPort(p);
    setToken(t);
    setMtls(m);
    setCert(c);
    setKey(k);
    setCa(caPath);
    setPush(pushNotif);
    await invoke("save_cloud_credentials", {
      token: t || null,
      cert: c || null,
      key: k || null,
      ca: caPath || null,
    });
    await invoke("set_server_settings", {
      host: h,
      port: p,
      token: t || null,
      mtls: m
        ? { cert: c || "", key: k || "", ca: caPath || null }
        : null,
    });
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
        headers: reqJwt && t ? { Authorization: `Bearer ${t}` } : undefined,
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={m} onChange={(e) => setM(e.currentTarget.checked)} />
          Use mTLS
        </label>
        {m && (
          <div className="space-y-1">
            <label className="flex flex-col text-sm">
              Client Cert
              <input className="border p-1" value={c} onChange={(e) => setC(e.currentTarget.value)} />
            </label>
            <label className="flex flex-col text-sm">
              Client Key
              <input className="border p-1" value={k} onChange={(e) => setK(e.currentTarget.value)} />
            </label>
            <label className="flex flex-col text-sm">
              Custom CA
              <input className="border p-1" value={caPath} onChange={(e) => setCaPath(e.currentTarget.value)} />
            </label>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={reqJwt} onChange={(e) => setReqJwt(e.currentTarget.checked)} />
          ✚ Require JWT
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pushNotif} onChange={(e) => setPushLocal(e.currentTarget.checked)} />
          Push Notifications (beta)
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
