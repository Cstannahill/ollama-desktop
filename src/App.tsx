import "./App.css";
import ModelPicker from "./components/ModelPicker";
import ChatPane from "./components/ChatPane";
import ChatInput from "./components/ChatInput";
import ToolsSidebar from "./components/ToolsSidebar";
import ToolPicker from "./components/ToolPicker";
import ToolPermissionModal from "./components/ToolPermissionModal";

function App() {
  return (
    <div className="flex h-screen">
      <ToolPermissionModal />
      <ToolsSidebar />
      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center gap-4">
          <ModelPicker />
          <ToolPicker />
        </div>
        <ChatPane />
        <ChatInput />
      </div>
    </div>
  );
}

export default App;
