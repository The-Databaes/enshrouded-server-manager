import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { browserMockRuntimeApi } from "@/lib/server/runtime-mock";
import type {
  LogLine,
  PlayerSample,
  RuntimeStatus,
} from "@/lib/server/runtime-types";

type Unlisten = () => void;

export type RuntimeApi = {
  status: () => Promise<RuntimeStatus>;
  /** Console output kept from this session, oldest first. */
  log: () => Promise<LogLine[]>;
  playerHistory: () => Promise<PlayerSample[]>;
  start: () => Promise<RuntimeStatus>;
  /** Asks the server to save and shut down; resolves once asked. */
  stop: () => Promise<RuntimeStatus>;
  restart: () => Promise<RuntimeStatus>;
  /** Closes the server without letting it save. */
  kill: () => Promise<RuntimeStatus>;
  /** Force-closes a server the manager didn't start. */
  killExternal: (pid: number) => Promise<RuntimeStatus>;
  onStatus: (handler: (status: RuntimeStatus) => void) => Promise<Unlisten>;
  onLog: (handler: (lines: LogLine[]) => void) => Promise<Unlisten>;
  /** The window was closed while the server runs (see `quit`). */
  onCloseRequested: (handler: () => void) => Promise<Unlisten>;
  /** Quit the app, stopping the server first (or at once, with `force`). */
  quit: (force: boolean) => Promise<void>;
};

const tauriApi: RuntimeApi = {
  status: () => invoke("server_runtime_status"),
  log: () => invoke("server_log"),
  playerHistory: () => invoke("server_player_history"),
  start: () => invoke("server_start"),
  stop: () => invoke("server_stop"),
  restart: () => invoke("server_restart"),
  kill: () => invoke("server_kill"),
  killExternal: (pid) => invoke("server_kill_external", { pid }),
  onStatus: (handler) =>
    listen<RuntimeStatus>("server://status", (e) => handler(e.payload)),
  onLog: (handler) =>
    listen<LogLine[]>("server://log", (e) => handler(e.payload)),
  onCloseRequested: (handler) =>
    listen("app://close-requested", () => handler()),
  quit: (force) => invoke("app_quit", { force }),
};

/** The running server; a simulation outside Tauri (see `steamcmdApi`). */
export const runtimeApi = (): RuntimeApi =>
  isTauri() ? tauriApi : browserMockRuntimeApi;
