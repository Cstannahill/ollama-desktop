import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";

export interface ThreadSettings {
  topK: number;
  ctxTokens: number;
  weights: Record<string, number>;
  setTopK: (v: number) => void;
  setCtxTokens: (v: number) => void;
  setWeight: (id: string, w: number) => void;
}

export const useThreadSettings = create<ThreadSettings>()(
  persist(
    (set, _get) => ({
      topK: 4,
      ctxTokens: 1024,
      weights: {},
      setTopK: (v) => {
        set({ topK: v });
      },
      setCtxTokens: (v) => {
        set({ ctxTokens: v });
      },
      setWeight: (id, w) => {
        set((s) => ({ weights: { ...s.weights, [id]: w } }));
        invoke("set_vector_weight", { vectorId: id, weight: w }).catch(() => {});
      },
    }),
    { name: "threadSettings" }
  )
);
