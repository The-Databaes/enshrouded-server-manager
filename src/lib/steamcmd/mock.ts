/*
 * Browser-only stand-in for the SteamCMD commands, used when the UI runs
 * outside Tauri (e.g. `pnpm dev:vite`). Nothing here touches the disk or the
 * network. Seed a starting state with `?mockSteamcmd=ready|external|missing`.
 */
import { cancelMockServerJob } from "@/lib/server/mock";
import type { SteamCmdApi } from "@/lib/steamcmd/api";
import type { SteamCmdEvent, SteamCmdStatus } from "@/lib/steamcmd/types";

const MANAGED_DIR = "C:\\Users\\you\\.enshrouded-server-manager\\steamcmd";
const MANAGED_EXE = `${MANAGED_DIR}\\steamcmd.exe`;
const FAKE_EXISTING = "C:\\steamcmd\\steamcmd.exe";

let config: { executable: string; managed: boolean; at: number | null } | null =
  null;
let present = true;
let cancelled = false;
let busy = false;
let seeded = false;

const seed = () => {
  if (seeded || typeof window === "undefined") return;
  seeded = true;
  const mode = new URLSearchParams(window.location.search).get("mockSteamcmd");
  const at = Math.floor(Date.now() / 1000) - 3 * 86_400;
  if (mode === "ready") config = { executable: MANAGED_EXE, managed: true, at };
  if (mode === "external")
    config = { executable: FAKE_EXISTING, managed: false, at: null };
  if (mode === "missing") {
    config = { executable: FAKE_EXISTING, managed: false, at: null };
    present = false;
  }
};

const status = (): SteamCmdStatus => {
  seed();
  return {
    availability: !config ? "notConfigured" : present ? "ready" : "missing",
    executable: config?.executable ?? null,
    managed: config?.managed ?? false,
    lastUpdatedAt: config?.at ?? null,
    managedDir: MANAGED_DIR,
    busy,
    canDownload: true,
  };
};

const sleep = (ms: number) =>
  new Promise<void>((resolve, reject) =>
    setTimeout(() => {
      if (cancelled) reject({ kind: "cancelled", message: "Cancelled." });
      else resolve();
    }, ms),
  );

const simulateSelfUpdate = async (emit: (e: SteamCmdEvent) => void) => {
  emit({ event: "stage", data: { stage: "updating" } });
  emit({ event: "log", data: { line: `Running ${MANAGED_EXE} +quit` } });
  for (const line of [
    "Redirecting stderr to 'logs\\stderr.txt'",
    "[  0%] Checking for available update...",
  ]) {
    emit({ event: "log", data: { line } });
    await sleep(250);
  }
  for (let pct = 0; pct <= 100; pct += 4) {
    const line = `[${String(pct).padStart(3)}%] Downloading update (${Math.round(pct * 434.72).toLocaleString()} of 43,472 KB)...`;
    emit({
      event: "progress",
      data: {
        percent: pct,
        label: "Downloading update",
        current: Math.round(pct * 434.72) * 1024,
        total: 43_472 * 1024,
      },
    });
    emit({ event: "log", data: { line } });
    await sleep(90);
  }
  for (const line of [
    "[----] Extracting package...",
    "[----] Installing update...",
    "[----] Cleaning up...",
    "[----] Update complete, launching...",
    "SteamCMD exited (exit code: 7)",
  ]) {
    emit({ event: "log", data: { line } });
    await sleep(200);
  }
};

const run = async <T>(task: () => Promise<T>) => {
  if (busy)
    throw {
      kind: "busy",
      message: "Another SteamCMD task is already running.",
    };
  busy = true;
  cancelled = false;
  try {
    return await task();
  } finally {
    busy = false;
  }
};

export const browserMockApi: SteamCmdApi = {
  status: async () => status(),
  inspect: async (path) => {
    const p = path.trim();
    if (!p)
      return {
        executable: null,
        error: "Enter the folder SteamCMD is installed in.",
      };
    if (!/^[a-z]:\\/i.test(p))
      return { executable: null, error: "Use a full path, e.g. C:\\steamcmd." };
    if (/steamcmd(\.exe)?\\?$/i.test(p))
      return {
        executable: p.toLowerCase().endsWith(".exe")
          ? p
          : `${p.replace(/\\$/, "")}\\steamcmd.exe`,
        error: null,
      };
    return {
      executable: null,
      error: "There's no steamcmd.exe in this folder.",
    };
  },
  detect: async () => [FAKE_EXISTING],
  adoptExisting: async (path) => {
    const check = await browserMockApi.inspect(path);
    if (!check.executable)
      throw { kind: "invalidPath", message: check.error ?? "Invalid path." };
    config = { executable: check.executable, managed: false, at: null };
    present = true;
    return status();
  },
  install: (emit) =>
    run(async () => {
      emit({ event: "stage", data: { stage: "downloading" } });
      emit({
        event: "log",
        data: {
          line: "Downloading https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip",
        },
      });
      const total = 3_870_000;
      for (let received = 0; received <= total; received += 193_500) {
        emit({ event: "download", data: { received, total } });
        await sleep(70);
      }
      emit({ event: "stage", data: { stage: "extracting" } });
      emit({ event: "log", data: { line: `Unpacking into ${MANAGED_DIR}` } });
      await sleep(400);
      await simulateSelfUpdate(emit);
      config = {
        executable: MANAGED_EXE,
        managed: true,
        at: Math.floor(Date.now() / 1000),
      };
      present = true;
      return status();
    }),
  update: (emit) =>
    run(async () => {
      await simulateSelfUpdate(emit);
      if (config) config.at = Math.floor(Date.now() / 1000);
      return status();
    }),
  cancel: async () => {
    cancelled = true;
    cancelMockServerJob();
  },
  forget: async () => {
    config = null;
    present = true;
    return status();
  },
  browse: async () =>
    window.prompt("SteamCMD folder (browser preview)", "C:\\steamcmd"),
  reveal: async (path) => {
    console.info("[mock] reveal", path);
  },
};
