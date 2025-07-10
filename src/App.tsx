import "./App.css";
import React, { useState } from "react";
import ModelPicker from "./components/ModelPicker";
import ChatPane from "./components/ChatPane";
import ChatInput from "./components/ChatInput";
import ToolsSidebar from "./components/ToolsSidebar";
import ToolPicker from "./components/ToolPicker";
import ToolPermissionModal from "./components/ToolPermissionModal";
import AuditLogModal from "./components/AuditLogModal";

function App() {
  const [showLog, setShowLog] = useState(false);
  return (
    <div className="flex h-screen">
      <ToolPermissionModal />
      {showLog && <AuditLogModal onClose={() => setShowLog(false)} />}
      <ToolsSidebar />
      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center gap-4">
          <ModelPicker />
          <ToolPicker />
          <button className="border rounded px-2" onClick={() => setShowLog(true)}>
            Audit Log
          </button>
        </div>
        <ChatPane />
        <ChatInput />
      </div>
    </div>
  );
}

export default App;
