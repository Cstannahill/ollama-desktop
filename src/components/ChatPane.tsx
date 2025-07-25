import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useChatStore } from "../stores/chatStore";
import { ChatStatus } from "./ChatStatus";

export default function ChatPane() {
  const { messages, chatStatus } = useChatStore();
  return (
    <div className="flex-1 overflow-y-auto my-2">
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role === "user" ? "text-right" : "text-left"}>
          {msg.role === "tool" && msg.name === "shell_exec" && (
            <pre className="bg-muted text-sm p-2 rounded mb-1 whitespace-pre-wrap border border-border">{msg.text}</pre>
          )}
          {msg.role === "tool" && msg.name !== "shell_exec" && (
            <div className="bg-muted text-sm p-2 rounded mb-1 border border-border">🔧 {msg.text}</div>
          )}
          {msg.role !== "tool" && (
            <ReactMarkdown
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter language={match[1]} PreTag="div" {...props}>
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {msg.text}
            </ReactMarkdown>
          )}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex gap-2 justify-end">
              {msg.attachments.map((a) => (
                <span key={a.name} className="text-xs">
                  📄 {a.name} • {a.status}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Show chat status when there's an active status */}
      {chatStatus && <ChatStatus status={chatStatus} />}
    </div>
  );
}
