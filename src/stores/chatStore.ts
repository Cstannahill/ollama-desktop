import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from 'sonner'

export type Attachment = { name: string; mime: string; status: "processing" | "ready" | "error" };

export type Message = { id: string; role: "user" | "assistant" | "tool"; text: string; name?: string; attachments?: Attachment[] };

export type Chat = { 
  id: string; 
  title: string; 
  threadId: string; 
  messages: Message[]; 
  projectId?: string; // Optional project association
  createdAt?: string; 
  updatedAt?: string; 
};

export type ChatStatusType = {
  type: 'loading' | 'error' | 'success' | 'tool-executing';
  message: string;
} | null;

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
  chatStatus: ChatStatusType;
  setChatStatus: (status: ChatStatusType) => void;
  newChat: (projectId?: string) => void;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, newTitle: string) => void;
  loadChats: () => Promise<void>;
  saveCurrentChat: () => Promise<void>;
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
  chatStatus: null,
  setChatStatus: (status) => set({ chatStatus: status }),
  toggleTool: (name) =>
    set((s) => {
      const has = s.enabledTools.includes(name);
      return { enabledTools: has ? s.enabledTools.filter((t) => t !== name) : [...s.enabledTools, name] };
    }),
  newChat: (projectId?: string) => {
    const id = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    const now = new Date().toISOString();
    const chat: Chat = { 
      id, 
      title: "New Chat", 
      threadId, 
      messages: [], 
      projectId,
      createdAt: now, 
      updatedAt: now 
    };
    set((s) => ({ chats: [...s.chats, chat], currentChatId: id, messages: [] }));
  },
  selectChat: (id) => {
    const chat = get().chats.find((c) => c.id === id);
    if (chat) {
      set({ currentChatId: id, messages: chat.messages });
    }
  },
  deleteChat: async (id) => {
    try {
      await invoke("delete_chat", { chatId: id });
      set((s) => ({
        chats: s.chats.filter((c) => c.id !== id),
        currentChatId: s.currentChatId === id ? null : s.currentChatId,
        messages: s.currentChatId === id ? [] : s.messages,
      }));
      toast("Chat deleted");
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast("Failed to delete chat");
    }
  },
  renameChat: async (id: string, newTitle: string) => {
    console.log('🔄 renameChat called with:', { id, newTitle });
    try {
      const { chats } = get();
      const chat = chats.find(c => c.id === id);
      if (!chat) {
        console.error('❌ Chat not found with id:', id);
        return;
      }

      console.log('📝 Found chat to rename:', chat.title, '->', newTitle);
      const updatedChat = { ...chat, title: newTitle, updatedAt: new Date().toISOString() };
      
      console.log('💾 Saving updated chat...');
      await invoke("save_chat", { chat: updatedChat });
      
      console.log('✅ Chat saved, updating store...');
      set((s) => ({
        chats: s.chats.map(c => c.id === id ? updatedChat : c)
      }));

      toast("Chat renamed");
      console.log('✅ Chat rename completed successfully');
    } catch (error) {
      console.error("❌ Failed to rename chat:", error);
      toast("Failed to rename chat");
    }
  },
  loadChats: async () => {
    try {
      const chats = await invoke<Chat[]>("load_chats");
      set({ chats });
    } catch (error) {
      console.error("Failed to load chats:", error);
      toast("Failed to load chats");
    }
  },
  saveCurrentChat: async () => {
    const { currentChatId, chats } = get();
    if (!currentChatId) return;
    
    const chat = chats.find((c) => c.id === currentChatId);
    if (!chat) return;
    
    try {
      const updatedChat = {
        ...chat,
        updatedAt: new Date().toISOString(),
      };
      
      await invoke("save_chat", { chat: updatedChat });
      
      // Update the chat in the store
      set((s) => ({
        chats: s.chats.map((c) => 
          c.id === currentChatId ? updatedChat : c
        ),
      }));
    } catch (error) {
      console.error("Failed to save chat:", error);
    }
  },
  send: async (text: string, attachments: Attachment[] = []) => {
    // Reduce console logging for better performance
    
    // Set initial loading status
    get().setChatStatus({ type: 'loading', message: 'Preparing message...' });
    
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

    // Throttle token updates for smoother performance
    let tokenBuffer = '';
    let lastTokenUpdate = 0;
    const TOKEN_UPDATE_INTERVAL = 50; // 50ms throttle for smoother updates
    
    const updateTokens = () => {
      if (!tokenBuffer) return;
      
      const currentBuffer = tokenBuffer;
      tokenBuffer = '';
      
      set((s) => {
        // Only update current messages for better performance
        const updatedMessages = s.messages.map((m) =>
          m.id === assistantId ? { ...m, text: m.text + currentBuffer } : m
        );
        
        // Only update the specific chat, not all chats
        const updatedChats = s.chats.map((c) => {
          if (c.id !== chatId) return c;
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId ? { ...m, text: m.text + currentBuffer } : m
            )
          };
        });
        
        return { 
          ...s,
          chats: updatedChats, 
          messages: updatedMessages 
        };
      });
    };

    const unlistenToken = await listen<string>("chat-token", (e) => {
      // Optimize: Only update if we have actual content
      if (!e.payload) return;
      
      tokenBuffer += e.payload;
      
      const now = Date.now();
      if (now - lastTokenUpdate >= TOKEN_UPDATE_INTERVAL) {
        lastTokenUpdate = now;
        updateTokens();
      }
    });

    let toolMsgId: string | null = null;
    const unlistenTool = await listen<{ name: string; content: string }>(
      "tool-message",
      (e) => {
        get().setChatStatus({ type: 'tool-executing', message: `Executing ${e.payload.name}...` });
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
      listen("chat-end", () => {
        // Flush any remaining tokens before ending
        updateTokens();
        resolve();
      });
    });

    try {
      
      get().setChatStatus({ type: 'loading', message: 'Generating response...' });
      
      await invoke("generate_chat", {
        model: get().currentModel,
        prompt: text,
        ragEnabled: get().ragEnabled,
        enabledTools: get().enabledTools,
        allowedTools: get().enabledTools,
        threadId,
      });
      
      await done;
      
      // Auto-save the chat after completion
      await get().saveCurrentChat();
      
      // Clear status on successful completion
      get().setChatStatus(null);
    } catch (e: any) {
      console.error("❌ Error in generate_chat:", e);
      get().setChatStatus({ type: 'error', message: 'Failed to generate response' });
      toast('Error sending message');
      // Clear error status after 3 seconds
      setTimeout(() => get().setChatStatus(null), 3000);
    } finally {
      unlistenToken();
      unlistenTool();
      unlistenStream();
    }
  },
}));
