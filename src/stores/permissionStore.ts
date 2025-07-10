import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PermState {
  allowedToolsByThread: Record<string, string[]>;
  currentThreadId: string;
  pendingTool: string | null;
  requestPermission: (tool: string) => void;
  grantPermission: (tool: string) => void;
  denyPermission: () => void;
  setThreadId: (id: string) => void;
}

export const usePermissionStore = create<PermState>()(
  persist(
    (set) => ({
      allowedToolsByThread: {},
      currentThreadId: "",
      pendingTool: null,
      requestPermission: (tool) => set({ pendingTool: tool }),
      grantPermission: (tool) =>
        set((s) => {
          const id = s.currentThreadId;
          const existing = s.allowedToolsByThread[id] || [];
          return {
            pendingTool: null,
            allowedToolsByThread: {
              ...s.allowedToolsByThread,
              [id]: existing.includes(tool) ? existing : [...existing, tool],
            },
          };
        }),
      denyPermission: () => set({ pendingTool: null }),
      setThreadId: (id) => set({ currentThreadId: id }),
    }),
    { name: "permissions" }
  )
);
