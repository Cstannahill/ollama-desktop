import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePermissionStore } from "./permissionStore";
import { toast } from 'sonner'

export type Attachment = { name: string; mime: string; status: "processing" | "ready" | "error" };

export type Message = { id: string; role: "user" | "assistant" | "tool"; text: string; name?: string; attachments?: Attachment[] };

export type Chat = { id: string; title: string; threadId: string; messages: Message[] };

interface ChatState {
  chats: Chat[];
  currentChatId: string | null;
  messages: Message[];
  currentModel: string;
  setModel: (m: string) => void;
  ragEnabled: boolean;
  toggleRag: () => void;
  enabledTools: string[];
  toggleTool: (name: string) => void;
  newChat: () => void;
  selectChat: (id: string) => void;
  send: (text: string, attachments?: Attachment[]) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
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
  newChat: () => {
    const id = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    const chat: Chat = { id, title: "New Chat", threadId, messages: [] };
    set((s) => ({ chats: [...s.chats, chat], currentChatId: id, messages: [] }));
    usePermissionStore.getState().setThreadId(threadId);
  },
  selectChat: (id) => {
    const chat = get().chats.find((c) => c.id === id);
    if (chat) {
      set({ currentChatId: id, messages: chat.messages });
      usePermissionStore.getState().setThreadId(chat.threadId);
    }
  },
  send: async (text: string, attachments: Attachment[] = []) => {
    let chatId = get().currentChatId;
    if (!chatId) {
      get().newChat();
      chatId = get().currentChatId as string;
    }
    const chat = get().chats.find((c) => c.id === chatId)!;
    const threadId = chat.threadId;

    const user: Message = { id: crypto.randomUUID(), role: "user", text, attachments };
    const assistant: Message = { id: crypto.randomUUID(), role: "assistant", text: "" };
    set((s) => {
      const chats = s.chats.map((c) =>
        c.id === chatId ? { ...c, messages: [...c.messages, user, assistant] } : c
      );
      return { chats, messages: [...s.messages, user, assistant] };
    });
    const assistantId = assistant.id;

    const unlistenToken = await listen<string>("chat-token", (e) => {
      set((s) => {
        const chats = s.chats.map((c) => {
          if (c.id !== chatId) return c;
          const msgs = c.messages.map((m) =>
            m.id === assistantId ? { ...m, text: m.text + e.payload } : m
          );
          return { ...c, messages: msgs };
        });
        const msgs = s.messages.map((m) =>
          m.id === assistantId ? { ...m, text: m.text + e.payload } : m
        );
        return { chats, messages: msgs };
      });
    });

    let toolMsgId: string | null = null;
    const unlistenTool = await listen<{ name: string; content: string }>(
      "tool-message",
      (e) => {
        set((s) => {
          const chats = s.chats.map((c) => {
            if (c.id !== chatId) return c;
            const idx = c.messages.findIndex((m) => m.id === assistantId);
            let msgs = [...c.messages];
            if (toolMsgId) {
              msgs = msgs.map((m) =>
                m.id === toolMsgId ? { ...m, text: e.payload.content, name: e.payload.name } : m
              );
            } else {
              toolMsgId = crypto.randomUUID();
              msgs.splice(idx, 0, {
                id: toolMsgId,
                role: "tool",
                text: e.payload.content,
                name: e.payload.name,
              });
            }
            return { ...c, messages: msgs };
          });
          const current = chats.find((c) => c.id === s.currentChatId);
          return { chats, messages: current ? current.messages : s.messages };
        });
      }
    );

    const unlistenStream = await listen<string>("tool-stream", (e) => {
      set((s) => {
        const chats = s.chats.map((c) => {
          if (c.id !== chatId) return c;
          const idx = c.messages.findIndex((m) => m.id === assistantId);
          let msgs = [...c.messages];
          if (!toolMsgId) {
            toolMsgId = crypto.randomUUID();
            msgs.splice(idx, 0, { id: toolMsgId, role: "tool", text: e.payload, name: "shell_exec" });
          } else {
            msgs = msgs.map((m) =>
              m.id === toolMsgId ? { ...m, text: m.text + e.payload } : m
            );
          }
          return { ...c, messages: msgs };
        });
        const current = chats.find((c) => c.id === s.currentChatId);
        return { chats, messages: current ? current.messages : s.messages };
      });
    });

    const done = new Promise<void>((resolve) => {
      listen("chat-end", () => resolve());
    });

    try {
      const permState = usePermissionStore.getState();
      const allowedTools =
        permState.allowedToolsByThread[threadId] || [];

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
      toast('Error sending message');
      try {
        const err = JSON.parse(e);
        if (err.code === "NeedPermission") {
          usePermissionStore.getState().requestPermission(err.tool);
        }
      } catch {}
    } finally {
      unlistenToken();
      unlistenTool();
      unlistenStream();
    }
  },
}));
