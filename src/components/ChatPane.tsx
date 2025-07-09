import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useChatStore } from "../stores/chatStore";

export default function ChatPane() {
  const { messages } = useChatStore();
  return (
    <div className="flex-1 overflow-y-auto my-2">
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role === "user" ? "text-right" : "text-left"}>
          <ReactMarkdown
            components={{
              code({ inline, className, children, ...props }) {
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
        </div>
      ))}
    </div>
  );
}
