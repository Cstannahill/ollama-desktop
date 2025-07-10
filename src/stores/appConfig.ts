import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppConfig {
  host: string;
  port: number;
  token: string;
  setHost: (h: string) => void;
  setPort: (p: number) => void;
  setToken: (t: string) => void;
}

export const useAppConfig = create<AppConfig>()(
  persist(
    (set) => ({
      host: "",
      port: 11434,
      token: "",
      setHost: (h) => set({ host: h }),
      setPort: (p) => set({ port: p }),
      setToken: (t) => set({ token: t }),
    }),
    { name: "appConfig" }
  )
);
