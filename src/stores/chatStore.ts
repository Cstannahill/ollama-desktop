import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Message = { id: string; role: "user" | "assistant"; text: string };

interface ChatState {
  messages: Message[];
  currentModel: string;
  setModel: (m: string) => void;
  send: (text: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentModel: "",
  setModel: (m) => set({ currentModel: m }),
  send: async (text: string) => {
    const user: Message = { id: crypto.randomUUID(), role: "user", text };
    const assistant: Message = { id: crypto.randomUUID(), role: "assistant", text: "" };
    set((state) => ({ messages: [...state.messages, user, assistant] }));
    const assistantId = assistant.id;

    const unlisten = await listen<string>("chat-token", (e) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId ? { ...m, text: m.text + e.payload } : m
        ),
      }));
    });

    const done = new Promise<void>((resolve) => {
      listen("chat-end", () => resolve());
    });

    try {
      await invoke("generate_chat", {
        model: get().currentModel,
        prompt: text,
      });
      await done;
    } catch (e) {
      console.error(e);
    } finally {
      unlisten();
    }
  },
}));
