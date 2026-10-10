import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { browserMockServerApi } from "@/lib/server/mock";
import type { FolderCheck, ServerStatus } from "@/lib/server/types";
import type { SteamCmdEvent } from "@/lib/steamcmd/types";

type OnEvent = (e: SteamCmdEvent) => void;

export type ServerApi = {
  status: () => Promise<ServerStatus>;
  inspectFolder: (path: string) => Promise<FolderCheck>;
  install: (path: string, onEvent: OnEvent) => Promise<ServerStatus>;
  update: (onEvent: OnEvent) => Promise<ServerStatus>;
  verify: (onEvent: OnEvent) => Promise<ServerStatus>;
  checkUpdate: (onEvent: OnEvent) => Promise<ServerStatus>;
  forget: () => Promise<ServerStatus>;
  browse: (defaultPath?: string) => Promise<string | null>;
};

const channel = (onEvent: OnEvent) => {
  const ch = new Channel<SteamCmdEvent>();
  ch.onmessage = onEvent;
  return ch;
};

const tauriApi: ServerApi = {
  status: () => invoke("server_status"),
  inspectFolder: (path) => invoke("server_inspect_folder", { path }),
  install: (path, onEvent) =>
    invoke("server_install", { path, onEvent: channel(onEvent) }),
  update: (onEvent) => invoke("server_update", { onEvent: channel(onEvent) }),
  verify: (onEvent) => invoke("server_verify", { onEvent: channel(onEvent) }),
  checkUpdate: (onEvent) =>
    invoke("server_check_update", { onEvent: channel(onEvent) }),
  forget: () => invoke("server_forget"),
  browse: async (defaultPath) => {
    const picked = await open({
      directory: true,
      title: "Choose a folder for the Enshrouded server",
      defaultPath,
    });
    return typeof picked === "string" ? picked : null;
  },
};

/** Server-files backend; a simulation outside Tauri (see `steamcmdApi`). */
export const serverApi = (): ServerApi =>
  isTauri() ? tauriApi : browserMockServerApi;
