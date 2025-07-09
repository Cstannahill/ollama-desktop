import "./App.css";
import ModelPicker from "./components/ModelPicker";
import ChatPane from "./components/ChatPane";
import ChatInput from "./components/ChatInput";
import ToolsSidebar from "./components/ToolsSidebar";

function App() {
  return (
    <div className="flex h-screen">
      <ToolsSidebar />
      <div className="flex flex-col flex-1 p-4">
        <ModelPicker />
        <ChatPane />
        <ChatInput />
      </div>
    </div>
  );
}

export default App;
