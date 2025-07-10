import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePermissionStore } from "./permissionStore";

export type Attachment = { name: string; mime: string; status: "processing" | "ready" | "error" };

export type Message = { id: string; role: "user" | "assistant" | "tool"; text: string; attachments?: Attachment[] };

interface ChatState {
  messages: Message[];
  currentModel: string;
  setModel: (m: string) => void;
  ragEnabled: boolean;
  toggleRag: () => void;
  enabledTools: string[];
  toggleTool: (name: string) => void;
  send: (
    text: string,
    attachments: Attachment[],
    threadId: string,
    allowedTools: string[]
  ) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentModel: "",
  setModel: (m) => set({ currentModel: m }),
  ragEnabled: true,
  toggleRag: () => set((s) => ({ ragEnabled: !s.ragEnabled })),
  enabledTools: [],
  toggleTool: (name) =>
    set((s) => {
      const has = s.enabledTools.includes(name);
      return { enabledTools: has ? s.enabledTools.filter((t) => t !== name) : [...s.enabledTools, name] };
    }),
  send: async (
    text: string,
    attachments: Attachment[],
    threadId: string,
    allowedTools: string[]
  ) => {
    const user: Message = { id: crypto.randomUUID(), role: "user", text, attachments };
    const assistant: Message = { id: crypto.randomUUID(), role: "assistant", text: "" };
    set((state) => ({ messages: [...state.messages, user, assistant] }));
    const assistantId = assistant.id;

    const unlistenToken = await listen<string>("chat-token", (e) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId ? { ...m, text: m.text + e.payload } : m
        ),
      }));
    });

    const unlistenTool = await listen<{ name: string; content: string }>(
      "tool-message",
      (e) => {
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === assistantId);
          const msgs = [...s.messages];
          msgs.splice(idx, 0, {
            id: crypto.randomUUID(),
            role: "tool",
            text: e.payload.content,
          });
          return { messages: msgs };
        });
      }
    );

    const done = new Promise<void>((resolve) => {
      listen("chat-end", () => resolve());
    });

    try {
      await invoke("generate_chat", {
        model: get().currentModel,
        prompt: text,
        ragEnabled: get().ragEnabled,
        enabledTools: get().enabledTools,
        allowedTools,
        threadId,
      });
      await done;
    } catch (e: any) {
      console.error(e);
      try {
        const err = JSON.parse(e);
        if (err.code === "NeedPermission") {
          usePermissionStore.getState().requestPermission(err.tool);
        }
      } catch {}
    } finally {
      unlistenToken();
      unlistenTool();
    }
  },
}));
