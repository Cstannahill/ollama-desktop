import { useChatStore } from "../stores/chatStore";

const tools = ["Web Search", "File Read", "Code Exec"];

// TODO: per-file RAG weighting UI

export default function ToolsSidebar() {
  const { ragEnabled, toggleRag } = useChatStore();
  return (
    <aside className="w-40 p-2 border-r hidden sm:block">
      <h2 className="font-bold mb-2">Tools</h2>
      <div className="flex items-center gap-2 mb-2">
        <input type="checkbox" checked={ragEnabled} onChange={toggleRag} />
        <span>RAG</span>
      </div>
      <ul className="space-y-1">
        {tools.map((t) => (
          <li key={t} className="flex items-center gap-2">
            <input type="checkbox" disabled />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
