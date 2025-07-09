import React from "react";

const tools = ["Web Search", "File Read", "Code Exec"];

export default function ToolsSidebar() {
  return (
    <aside className="w-40 p-2 border-r hidden sm:block">
      <h2 className="font-bold mb-2">Tools</h2>
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
