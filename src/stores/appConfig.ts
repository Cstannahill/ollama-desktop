import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppConfig {
  host: string;
  port: number;
  token: string;
  mtls: boolean;
  cert: string;
  key: string;
  ca: string;
  push: boolean;
  setHost: (h: string) => void;
  setPort: (p: number) => void;
  setToken: (t: string) => void;
  setMtls: (b: boolean) => void;
  setCert: (p: string) => void;
  setKey: (p: string) => void;
  setCa: (p: string) => void;
  setPush: (b: boolean) => void;
}

export const useAppConfig = create<AppConfig>()(
  persist(
    (set) => ({
      host: "",
      port: 11434,
      token: "",
      mtls: false,
      cert: "",
      key: "",
      ca: "",
      push: false,
      setHost: (h) => set({ host: h }),
      setPort: (p) => set({ port: p }),
      setToken: (t) => set({ token: t }),
      setMtls: (b) => set({ mtls: b }),
      setCert: (p) => set({ cert: p }),
      setKey: (p) => set({ key: p }),
      setCa: (p) => set({ ca: p }),
      setPush: (b) => set({ push: b }),
    }),
    {
      name: "appConfig",
      partialize: (s) => ({ host: s.host, port: s.port, mtls: s.mtls, push: s.push }),
    }
  )
);
