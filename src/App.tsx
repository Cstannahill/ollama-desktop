import "./App.css";
import { useState, useEffect } from "react";
import ModelPicker from "./components/ModelPicker";
import ChatPane from "./components/ChatPane";
import ChatInput from "./components/ChatInput";
import ToolsSidebar from "./components/ToolsSidebar";
import ToolPicker from "./components/ToolPicker";
import ToolPermissionModal from "./components/ToolPermissionModal";
import AuditLogModal from "./components/AuditLogModal";
import ThreadSettingsModal from "./components/ThreadSettingsModal";
import ServerSettingsModal from "./components/ServerSettingsModal";
import { useAppConfig } from "./stores/appConfig";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

function App() {
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const { host, port, token, mtls, push, setToken, setCert, setKey, setCa } = useAppConfig();

  useEffect(() => {
    const detect = async () => {
      const creds: any = await invoke("load_cloud_credentials");
      if (creds) {
        if (creds.token) setToken(creds.token);
        if (creds.cert) setCert(creds.cert);
        if (creds.key) setKey(creds.key);
        if (creds.ca) setCa(creds.ca);
      }
      try {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch("http://127.0.0.1:11434/api/tags", { signal: ctrl.signal });
        clearTimeout(id);
        if (res.ok) {
          invoke("set_server_settings", { host: "http://127.0.0.1", port: 11434, token: null, mtls: null });
          return;
        }
      } catch {}
      if (host) {
        invoke("set_server_settings", { host, port, token: token || null, mtls: mtls ? { cert: creds?.cert || "", key: creds?.key || "", ca: creds?.ca || null } : null });
      }
    };
    detect();
    if (push && typeof window !== "undefined") {
      isPermissionGranted().then(async (granted) => {
        if (!granted) {
          const p = await requestPermission();
          if (p !== "granted") return;
        }
        const token = await invoke("register_device_token");
        if (token) await invoke("save_device_token", { token });
      });
      window.addEventListener("tauri://push", async () => {
        const events = await invoke("poll_notifications", { since: Date.now() });
        if (Array.isArray(events?.messages)) {
          for (const m of events.messages) {
            sendNotification({ title: "New Message", body: m.text });
          }
        }
      });
    }
  }, []);
  return (
    <div className="flex h-screen">
      <ToolPermissionModal />
      {showLog && <AuditLogModal onClose={() => setShowLog(false)} />}
      {showSettings && (
        <ThreadSettingsModal threadId="default" onClose={() => setShowSettings(false)} />
      )}
      {showServer && <ServerSettingsModal onClose={() => setShowServer(false)} />}
      <ToolsSidebar />
      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center gap-4">
          <ModelPicker />
          <ToolPicker />
          <button className="border rounded px-2" onClick={() => setShowLog(true)}>
            Audit Log
          </button>
          <button className="border rounded px-2" onClick={() => setShowSettings(true)}>
            Thread Settings
          </button>
          <button className="border rounded px-2" onClick={() => setShowServer(true)}>
            Server
          </button>
          {host.startsWith("https://") && token && <span title="secure" className="text-green-600">🔒</span>}
        </div>
        <ChatPane />
        <ChatInput />
      </div>
    </div>
  );
}

export default App;
