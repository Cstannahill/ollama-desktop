import { useState } from "react";
import { useChatStore } from "../stores/chatStore";

export default function ChatInput() {
  const [text, setText] = useState("");
  const { send, currentModel } = useChatStore();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) return;
    if (!currentModel) {
      alert("Pick a model first");
      return;
    }
    await send(text);
    setText("");
  };

  return (
    <form onSubmit={handle} className="flex gap-2">
      <textarea
        className="flex-1 border rounded p-1"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder="Say something..."
      />
      <button className="border rounded px-3" type="submit">
        Send
      </button>
    </form>
  );
}
