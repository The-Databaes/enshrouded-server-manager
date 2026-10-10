import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { browserMockApi } from "@/lib/steamcmd/mock";
import type {
  AppError,
  PathCheck,
  SteamCmdEvent,
  SteamCmdStatus,
} from "@/lib/steamcmd/types";

export type SteamCmdApi = {
  status: () => Promise<SteamCmdStatus>;
  inspect: (path: string) => Promise<PathCheck>;
  detect: () => Promise<string[]>;
  adoptExisting: (path: string) => Promise<SteamCmdStatus>;
  install: (onEvent: (e: SteamCmdEvent) => void) => Promise<SteamCmdStatus>;
  update: (onEvent: (e: SteamCmdEvent) => void) => Promise<SteamCmdStatus>;
  cancel: () => Promise<void>;
  forget: (deleteFiles: boolean) => Promise<SteamCmdStatus>;
  /** Native folder picker; resolves to `null` if the user backs out. */
  browse: (defaultPath?: string) => Promise<string | null>;
  reveal: (path: string) => Promise<void>;
};

const channel = (onEvent: (e: SteamCmdEvent) => void) => {
  const ch = new Channel<SteamCmdEvent>();
  ch.onmessage = onEvent;
  return ch;
};

const tauriApi: SteamCmdApi = {
  status: () => invoke("steamcmd_status"),
  inspect: (path) => invoke("steamcmd_inspect", { path }),
  detect: () => invoke("steamcmd_detect"),
  adoptExisting: (path) => invoke("steamcmd_adopt_existing", { path }),
  install: (onEvent) =>
    invoke("steamcmd_install", { onEvent: channel(onEvent) }),
  update: (onEvent) => invoke("steamcmd_update", { onEvent: channel(onEvent) }),
  cancel: () => invoke("steamcmd_cancel"),
  forget: (deleteFiles) => invoke("steamcmd_forget", { deleteFiles }),
  browse: async (defaultPath) => {
    const picked = await open({
      directory: true,
      title: "Select your SteamCMD folder",
      defaultPath,
    });
    return typeof picked === "string" ? picked : null;
  },
  reveal: (path) => revealItemInDir(path),
};

/**
 * SteamCMD backend. Inside the Tauri window this calls the Rust commands; in a
 * plain browser (`pnpm dev:vite`, used for UI work) it falls back to an
 * in-memory simulation so every screen can still be exercised.
 */
export const steamcmdApi = (): SteamCmdApi =>
  isTauri() ? tauriApi : browserMockApi;

/** Normalise whatever a command rejected with into `{ kind, message }`. */
export const toAppError = (error: unknown): AppError => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const kind = "kind" in error ? error.kind : "unknown";
    return { kind: kind as AppError["kind"], message: error.message };
  }
  return { kind: "unknown", message: String(error) };
};
