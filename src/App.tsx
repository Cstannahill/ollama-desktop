import React, { useState, useEffect } from "react";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "./stores/chatStore";
import "./App.css";

const fetcher = () => invoke<string[]>("list_models");

function App() {
  const { data: models } = useSWR("models", fetcher);
  const { messages, send, currentModel, setModel } = useChatStore();
  const [text, setText] = useState("");

  useEffect(() => {
    if (models && models.length > 0 && !currentModel) {
      setModel(models[0]);
    }
  }, [models, currentModel, setModel]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) return;
    if (!currentModel) {
      alert("Please select a model first");
      return;
    }
    await send(text);
    setText("");
  };

  return (
    <main className="container">
      <div>
        <select value={currentModel} onChange={(e) => setModel(e.target.value)}>
          {models?.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="chat">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role}>
            <ReactMarkdown
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
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
      <form onSubmit={handleSend} className="row">
        <input
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder="Say something..."
        />
        <button type="submit">Send</button>
      </form>
    </main>
  );
}

export default App;
