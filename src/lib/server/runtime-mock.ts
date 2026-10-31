/*
 * Browser-only stand-in for the running server (see `steamcmd/mock.ts`):
 * starts, answers "queries", streams console lines and stops like the real
 * thing, on timers. Seed a starting state with
 * `?mockRuntime=running|starting|stopped|crashed|external`.
 */
import type { RuntimeApi } from "@/lib/server/runtime-api";
import type {
  LineKind,
  LogLine,
  OnlinePlayer,
  PlayerSample,
  RuntimeStatus,
} from "@/lib/server/runtime-types";

const EXE =
  "C:\\Users\\you\\.enshrouded-server-manager\\server\\enshrouded_server.exe";
const GB = 1024 ** 3;
const NAMES = ["Thalia", "Brannoc", "Ilyra", "Corwen", "Maelis"];

/** Trimmed from a real server start. */
const STARTUP_LINES = [
  "[Server] Version: 0.0.15.0",
  "[savedata] Using save directory ./savegame",
  "[game_server] Switching state from Init to Load after 412.04 ms",
  "[Server][Water] Added Water Dispenser: id: [ 2924478841 ]  pos: [ 10834, 1697, 9308 ]",
  "[game_server] Switching state from Load to LoadEcsScene after 2.10 s",
  "[online] Server is not VAC Secure!",
  "[online] Server SteamId: 90294892379043857",
  "[OnlineProviderSteam] 'Initialize' (up)!",
  "[OnlineProviderSteam] 'JoinOrCreateGame' (up)!",
  "[Session] 'HostOnline' (up)!",
  "[game_server] Switching state from LoadEcsScene to Run after 165.17 ms",
];
const SHUTDOWN_LINES = [
  "[Session] 'HostOnline' (down)!",
  "[server] Save Serialization took 139.07 ms over 9 Ticks",
  "[server] Saved",
  "[app] start destruction step Init_Steamworks",
  "[enshrouded] Close Log file",
];

type Handler<T> = (value: T) => void;

let status: RuntimeStatus = {
  revision: 0,
  phase: "stopped",
  pid: null,
  startedAt: null,
  onlineAt: null,
  stopRequestedAt: null,
  queryAddress: null,
  responding: false,
  usage: null,
  totalMemoryBytes: 32 * GB,
  query: null,
  players: [],
  lastExit: null,
  externalPid: null,
};
let log: LogLine[] = [];
let history: PlayerSample[] = [];
let seq = 0;
let seeded = false;
let ticker: ReturnType<typeof setInterval> | null = null;
const statusHandlers = new Set<Handler<RuntimeStatus>>();
const logHandlers = new Set<Handler<LogLine[]>>();

const set = (change: Partial<RuntimeStatus>) => {
  status = { ...status, ...change, revision: status.revision + 1 };
  for (const h of statusHandlers) h(status);
};

const write = (kind: LineKind, texts: string[]) => {
  const lines = texts.map((text) => ({
    seq: ++seq,
    at: Date.now(),
    kind,
    text,
  }));
  log = [...log, ...lines].slice(-5000);
  for (const h of logHandlers) h(lines);
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The `i`th player to join, as the real server's console identifies them. */
const mockPlayer = (i: number, joinedAt: number): OnlinePlayer => ({
  name: NAMES[i],
  steamId: `7656119840008${String(1236 + i * 311).padStart(4, "0")}`,
  handle: `${i}(${i})`,
  joinedAt,
});

/** Trimmed from what a real join and leave print. */
const joinLines = (p: OnlinePlayer, i: number) => [
  `[online] Added peer ${i}(${i + 1}) (steamid:${p.steamId})`,
  `[session] Unable to find machine for peer ${i}(${i + 1}).`,
  `[session] Add remote machine index ${i + 1} (id: ${809705657 + i}).`,
  `[server] Machine '${i + 1}': Player '${p.handle}' logged in`,
  `[server] Player '${p.name}' logged in with Permissions:`,
  "         - CanAccessInventories",
  "         - CanEditBase",
];
const leaveLines = (p: OnlinePlayer, i: number) => [
  `[server] Remove Player '${p.name}'`,
  `[online] Removed peer ${i}(${i + 1})`,
  `[session] Player removed. Player handle: ${p.handle}`,
];

const tick = () => {
  if (status.phase !== "running" && status.phase !== "starting") return;
  const base = status.usage?.memoryBytes ?? 0.7 * GB;
  const usage = {
    cpuPercent: 2 + Math.random() * 6,
    memoryBytes: Math.min(
      6 * GB,
      base + (Math.random() - 0.3) * 40 * 1024 ** 2,
    ),
  };
  if (status.phase !== "running" || !status.query) return set({ usage });
  const drift = Math.random() < 0.15 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  let players = status.players;
  const last = players.length - 1;
  if (drift > 0 && players.length < NAMES.length) {
    const joined = mockPlayer(players.length, Date.now());
    write("output", joinLines(joined, players.length));
    players = [...players, joined];
  } else if (drift < 0 && last >= 0) {
    write("output", leaveLines(players[last], last));
    players = players.slice(0, last);
  }
  set({
    usage,
    query: { ...status.query, players: players.length },
    players,
  });
  if (Math.random() < 0.2)
    write("output", [
      "-------------- Session ----------------",
      `  m#0(128): up 0 (0), down 0 (0), remote ${players.length} (0), limit 256, lost 0, ping 34 ms`,
      "---------------------------------------",
    ]);
};

const goOnline = (startedAt: number, players = 0) => {
  set({
    phase: "running",
    onlineAt: Date.now(),
    responding: true,
    startedAt,
    query: {
      name: "Embervale",
      version: "0.0.15.0",
      players,
      maxPlayers: 16,
    },
    players: Array.from({ length: players }, (_, i) =>
      mockPlayer(i, Date.now() - (600 + i * 1700) * 1000),
    ),
  });
};

const ensureTicker = () => {
  if (ticker === null) ticker = setInterval(tick, 2000);
};

const seed = () => {
  if (seeded || typeof window === "undefined") return;
  seeded = true;
  const mode = new URLSearchParams(window.location.search).get("mockRuntime");
  const now = Date.now();
  const hour = 3_600_000;
  // A day of player counts that look like an evening crowd.
  history = Array.from({ length: 24 * 60 }, (_, i) => {
    const at = Math.floor((now - (24 * 60 - i) * 60_000) / 1000);
    const h = new Date(at * 1000).getHours();
    const crowd = h >= 18 ? 4 : h >= 12 ? 2 : h >= 8 ? 1 : 0;
    return { at, players: Math.max(0, crowd + Math.round(Math.sin(i / 37))) };
  });
  write("info", [`> ${EXE}`]);
  write("output", STARTUP_LINES);
  if (mode === "running") {
    status = { ...status, pid: 41436, queryAddress: "127.0.0.1:15637" };
    goOnline(now - 26 * hour - 14 * 60_000, 3);
    write("info", ["The server is up: answering on 127.0.0.1:15637 after 9s."]);
    ensureTicker();
  } else if (mode === "starting") {
    void start();
  } else if (mode === "crashed") {
    write("output", ["[error] Unhandled exception 0xC0000005"]);
    write("error", ["The server stopped unexpectedly (exit code 3221225477)."]);
    set({
      lastExit: {
        reason: "unexpected",
        code: 3221225477,
        at: now - 4 * 60_000,
        ranForMs: 3 * hour,
      },
    });
  } else if (mode === "external") {
    set({ externalPid: 18244 });
  } else {
    write("output", SHUTDOWN_LINES);
    write("info", ["The server saved and stopped (exit code 0)."]);
    set({
      lastExit: {
        reason: "requested",
        code: 0,
        at: now - 2 * hour,
        ranForMs: 5 * hour,
      },
    });
  }
};

const start = async () => {
  seed();
  if (status.phase !== "stopped")
    throw { kind: "serverRunning", message: "The server is already running." };
  if (status.externalPid)
    throw {
      kind: "serverRunning",
      message: `The server in this folder is already running outside the manager (process ${status.externalPid}). Stop it there first.`,
    };
  const startedAt = Date.now();
  write("info", [`> ${EXE}`]);
  set({
    phase: "starting",
    pid: 41436,
    startedAt,
    onlineAt: null,
    stopRequestedAt: null,
    queryAddress: "127.0.0.1:15637",
    responding: false,
    usage: null,
    query: null,
    players: [],
    externalPid: null,
  });
  ensureTicker();
  void (async () => {
    for (const line of STARTUP_LINES) {
      await wait(350);
      if (status.phase !== "starting") return;
      write("output", [line]);
    }
    await wait(600);
    if (status.phase !== "starting") return;
    goOnline(startedAt);
    write("info", [
      `The server is up: answering on 127.0.0.1:15637 after ${Math.round((Date.now() - startedAt) / 1000)}s.`,
    ]);
  })();
  return status;
};

const stopped = (reason: "requested" | "forced") => {
  const ranForMs = Date.now() - (status.startedAt ?? Date.now());
  set({
    phase: "stopped",
    pid: null,
    startedAt: null,
    onlineAt: null,
    stopRequestedAt: null,
    queryAddress: null,
    responding: false,
    usage: null,
    query: null,
    players: [],
    lastExit: {
      reason,
      code: reason === "forced" ? 1 : 0,
      at: Date.now(),
      ranForMs,
    },
  });
  history = [
    ...history,
    { at: Math.floor(Date.now() / 1000), players: 0 },
  ].slice(-1440);
};

let stopping: Promise<void> | null = null;

const stop = async () => {
  seed();
  if (status.phase !== "starting" && status.phase !== "running") return status;
  set({ phase: "stopping", stopRequestedAt: Date.now() });
  write("info", ["Asking the server to save the world and shut down…"]);
  stopping = (async () => {
    for (const line of SHUTDOWN_LINES) {
      await wait(450);
      if (status.phase !== "stopping") return;
      write("output", [line]);
    }
    if (status.phase !== "stopping") return;
    stopped("requested");
    write("info", ["The server saved and stopped (exit code 0)."]);
  })();
  return status;
};

export const browserMockRuntimeApi: RuntimeApi = {
  status: async () => {
    seed();
    return status;
  },
  log: async () => {
    seed();
    return log;
  },
  playerHistory: async () => {
    seed();
    return history;
  },
  start,
  stop,
  restart: async () => {
    await stop();
    await stopping;
    return start();
  },
  kill: async () => {
    if (status.phase === "stopped") return status;
    write("info", ["Forcing the server to close."]);
    stopped("forced");
    write("info", ["The server was forced to close."]);
    return status;
  },
  killExternal: async (pid) => {
    write("info", [
      `Forced the server started outside the manager (process ${pid}) to close.`,
    ]);
    set({ externalPid: null });
    return status;
  },
  onStatus: async (handler) => {
    statusHandlers.add(handler);
    return () => statusHandlers.delete(handler);
  },
  onLog: async (handler) => {
    logHandlers.add(handler);
    return () => logHandlers.delete(handler);
  },
  // There's no window to close in a browser tab.
  onCloseRequested: async () => () => {},
  quit: async () => {
    window.alert("The app would quit here (browser preview).");
  },
};
