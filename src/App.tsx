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

function App() {
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const { host, port, token } = useAppConfig();

  useEffect(() => {
    const detect = async () => {
      try {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch("http://127.0.0.1:11434/api/tags", { signal: ctrl.signal });
        clearTimeout(id);
        if (res.ok) {
          invoke("set_server_settings", { host: "http://127.0.0.1", port: 11434, token: null });
          return;
        }
      } catch {}
      if (host) {
        invoke("set_server_settings", { host, port, token: token || null });
      }
    };
    detect();
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
        </div>
        <ChatPane />
        <ChatInput />
      </div>
    </div>
  );
}

export default App;
