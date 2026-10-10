/*
 * Browser-only stand-in for the server commands (see `steamcmd/mock.ts`).
 * Replays SteamCMD output shaped like the real thing. Seed a starting state
 * with `?mockServer=installed|update|incomplete`.
 */
import type { ServerApi } from "@/lib/server/api";
import type { FolderCheck, ServerStatus } from "@/lib/server/types";
import type { SteamCmdEvent } from "@/lib/steamcmd/types";

const DEFAULT_DIR = "C:\\Users\\you\\.enshrouded-server-manager\\server";
const STEAMCMD =
  "C:\\Users\\you\\.enshrouded-server-manager\\steamcmd\\steamcmd.exe";
const LATEST = "23178631";
const SIZE = 8_811_579_458;
/** Compressed download for SIZE bytes of files (from a real content log). */
const DOWNLOAD = 3_734_339_456;

type MockServer = {
  dir: string;
  build: string | null;
  complete: boolean;
  verifiedAt: number | null;
  latest: string | null;
  checkedAt: number | null;
};

let server: MockServer | null = null;
let cancelled = false;
let seeded = false;
const nowSecs = () => Math.floor(Date.now() / 1000);

const seed = () => {
  if (seeded || typeof window === "undefined") return;
  seeded = true;
  const mode = new URLSearchParams(window.location.search).get("mockServer");
  const day = 86_400;
  if (mode === "installed")
    server = {
      dir: DEFAULT_DIR,
      build: LATEST,
      complete: true,
      verifiedAt: nowSecs() - 2 * day,
      latest: LATEST,
      checkedAt: nowSecs() - 3600,
    };
  if (mode === "update")
    server = {
      dir: "D:\\Games\\Enshrouded Server",
      build: "22950117",
      complete: true,
      verifiedAt: nowSecs() - 9 * day,
      latest: LATEST,
      checkedAt: nowSecs() - 120,
    };
  if (mode === "incomplete")
    server = {
      dir: DEFAULT_DIR,
      build: null,
      complete: false,
      verifiedAt: null,
      latest: null,
      checkedAt: null,
    };
};

const status = (): ServerStatus => {
  seed();
  const installed = Boolean(server?.complete);
  return {
    state: !server ? "notInstalled" : installed ? "installed" : "incomplete",
    appId: "2278520",
    installDir: server?.dir ?? null,
    defaultInstallDir: DEFAULT_DIR,
    buildId: server?.build ?? null,
    sizeOnDisk: installed ? SIZE : null,
    lastUpdatedAt: installed ? nowSecs() - 5 * 86_400 : null,
    lastVerifiedAt: server?.verifiedAt ?? null,
    latestBuildId: server?.latest ?? null,
    lastCheckedAt: server?.checkedAt ?? null,
    updateAvailable:
      installed && server?.latest ? server.build !== server.latest : null,
  };
};

const sleep = (ms: number) =>
  new Promise<void>((resolve, reject) =>
    setTimeout(() => {
      if (cancelled) reject({ kind: "cancelled", message: "Cancelled." });
      else resolve();
    }, ms),
  );

const say = async (
  emit: (e: SteamCmdEvent) => void,
  lines: string[],
  ms = 120,
) => {
  for (const line of lines) {
    // Like SteamCMD, print "Waiting for…" first and the "OK" when it's done.
    if (line.endsWith("...OK")) {
      emit({ event: "partial", data: { line: line.slice(0, -2) } });
      await sleep(ms * 6);
    }
    emit({ event: "log", data: { line } });
    await sleep(ms);
  }
};

const preamble = [
  "Redirecting stderr to 'C:\\Users\\you\\.enshrouded-server-manager\\steamcmd\\logs\\stderr.txt'",
  "[  0%] Checking for available updates...",
  "[----] Verifying installation...",
  "Steam Console Client (c) Valve Corporation - version 1788292693",
  "-- type 'quit' to exit --",
  "Loading Steam API...OK",
  "Connecting anonymously to Steam Public...OK",
  "Waiting for client config...OK",
  "Waiting for user info...OK",
];

const simulateAppUpdate = async (
  emit: (e: SteamCmdEvent) => void,
  dir: string,
  phases: { label: string; code: string; steps: number }[],
) => {
  emit({
    event: "log",
    data: {
      line: `> ${STEAMCMD} +force_install_dir "${dir}" +login anonymous +app_update 2278520 validate +quit`,
    },
  });
  await say(emit, preamble);
  for (const { label, code, steps } of phases) {
    if (label === "downloading")
      emit({
        event: "downloadPlan",
        data: { downloadTotal: DOWNLOAD, stageTotal: SIZE },
      });
    for (let i = 0; i <= steps; i++) {
      const current = Math.round((SIZE * i) / steps);
      const percent = (current / SIZE) * 100;
      emit({
        event: "progress",
        data: { percent, label, current, total: SIZE },
      });
      emit({
        event: "log",
        data: {
          line: ` Update state (${code}) ${label}, progress: ${percent.toFixed(2)} (${current} / ${SIZE})`,
        },
      });
      await sleep(260);
    }
  }
  await say(emit, [
    "Success! App '2278520' fully installed.",
    "Unloading Steam API...OK",
    "SteamCMD exited with code 0",
  ]);
};

export const browserMockServerApi: ServerApi = {
  status: async () => status(),
  inspectFolder: async (path): Promise<FolderCheck> => {
    const p = path.trim();
    if (!p)
      return {
        kind: "invalid",
        message: "Choose a folder for the server files.",
        buildId: null,
      };
    if (!/^[a-z]:\\/i.test(p))
      return {
        kind: "invalid",
        message: "Use a full path, e.g. D:\\Enshrouded Server.",
        buildId: null,
      };
    if (/existing/i.test(p))
      return {
        kind: "existingInstall",
        message:
          "Existing server found (build 22950117). Its files will be verified.",
        buildId: "22950117",
      };
    if (/games$/i.test(p))
      return {
        kind: "notEmpty",
        message:
          "This folder already has other files in it. The server files will be added alongside them.",
        buildId: null,
      };
    return {
      kind: "empty",
      message: "The server will be installed here.",
      buildId: null,
    };
  },
  install: async (path, emit) => {
    cancelled = false;
    seed();
    server = {
      dir: path,
      build: null,
      complete: false,
      verifiedAt: null,
      latest: null,
      checkedAt: null,
    };
    await simulateAppUpdate(emit, path, [
      { label: "downloading", code: "0x61", steps: 40 },
      { label: "verifying install", code: "0x5", steps: 8 },
    ]);
    server = {
      ...server,
      build: LATEST,
      complete: true,
      verifiedAt: nowSecs(),
      latest: LATEST,
      checkedAt: nowSecs(),
    };
    return status();
  },
  update: async (emit) => {
    cancelled = false;
    if (!server) throw { kind: "invalidPath", message: "No server." };
    await simulateAppUpdate(emit, server.dir, [
      { label: "downloading", code: "0x61", steps: 12 },
    ]);
    server = { ...server, build: LATEST, latest: LATEST, checkedAt: nowSecs() };
    return status();
  },
  verify: async (emit) => {
    cancelled = false;
    if (!server) throw { kind: "invalidPath", message: "No server." };
    await simulateAppUpdate(emit, server.dir, [
      { label: "verifying install", code: "0x5", steps: 16 },
    ]);
    server = { ...server, complete: true, verifiedAt: nowSecs() };
    return status();
  },
  checkUpdate: async (emit) => {
    cancelled = false;
    emit({
      event: "log",
      data: {
        line: `> ${STEAMCMD} +login anonymous +app_info_update 1 +app_info_print 2278520 +quit`,
      },
    });
    await say(
      emit,
      [
        ...preamble,
        "AppID : 2278520, change number : 33618846/0, last change : Sat Oct 10 12:01:13 2026",
        '"2278520"',
        "{",
        '        "common"',
        "        {",
        '                "name"          "Enshrouded Dedicated Server"',
        "        }",
        '        "depots"',
        "        {",
        '                "branches"',
        "                {",
        '                        "public"',
        "                        {",
        `                                "buildid"               "${LATEST}"`,
        '                                "timeupdated"           "1778508351"',
        "                        }",
        "                }",
        "        }",
        "}",
        "Unloading Steam API...OK",
        "SteamCMD exited with code 0",
      ],
      60,
    );
    if (server) server = { ...server, latest: LATEST, checkedAt: nowSecs() };
    return status();
  },
  forget: async () => {
    server = null;
    return status();
  },
  browse: async () =>
    window.prompt("Server folder (browser preview)", "D:\\Enshrouded Server"),
};

/** Lets the shared SteamCMD cancel button stop a simulated server job. */
export const cancelMockServerJob = () => {
  cancelled = true;
};
