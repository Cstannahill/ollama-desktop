import "./App.css";
import { useState } from "react";
import ModelPicker from "./components/ModelPicker";
import ChatPane from "./components/ChatPane";
import ChatInput from "./components/ChatInput";
import ToolsSidebar from "./components/ToolsSidebar";
import ToolPicker from "./components/ToolPicker";
import ToolPermissionModal from "./components/ToolPermissionModal";
import AuditLogModal from "./components/AuditLogModal";
import ThreadSettingsModal from "./components/ThreadSettingsModal";

function App() {
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div className="flex h-screen">
      <ToolPermissionModal />
      {showLog && <AuditLogModal onClose={() => setShowLog(false)} />}
      {showSettings && (
        <ThreadSettingsModal threadId="default" onClose={() => setShowSettings(false)} />
      )}
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
        </div>
        <ChatPane />
        <ChatInput />
      </div>
    </div>
  );
}

export default App;
