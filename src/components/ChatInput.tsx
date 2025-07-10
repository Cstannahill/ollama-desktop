import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";
import { usePermissionStore } from "../stores/permissionStore";
import AttachmentDropZone, { PendingAttachment } from "./AttachmentDropZone";
import AttachmentTile from "./AttachmentTile";

export default function ChatInput() {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const threadIdRef = useRef(crypto.randomUUID());
  const { send, currentModel } = useChatStore();
  const { allowedToolsByThread, setThreadId } = usePermissionStore();

  useEffect(() => {
    setThreadId(threadIdRef.current);
  }, [setThreadId]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) return;
    if (!currentModel) {
      alert("Pick a model first");
      return;
    }
    await send(
      text,
      attachments,
      threadIdRef.current,
      allowedToolsByThread[threadIdRef.current] || []
    );
    setText("");
    setAttachments([]);
    threadIdRef.current = crypto.randomUUID();
    setThreadId(threadIdRef.current);
  };

  return (
    <form onSubmit={handle} className="flex gap-2">
      <textarea
        className="flex-1 border rounded p-1"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder="Say something..."
      />
      <button
        className="border rounded px-3"
        type="submit"
        disabled={attachments.some((a) => a.status === "processing")}
      >
        Send
      </button>
      <div className="flex gap-2">
        {attachments.map((a) => (
          <AttachmentTile key={a.name} id={a.name} name={`${a.name} • ${a.status}`} />
        ))}
      </div>
      <AttachmentDropZone
        threadId={threadIdRef.current}
        attachments={attachments}
        setAttachments={setAttachments}
      />
    </form>
  );
}
