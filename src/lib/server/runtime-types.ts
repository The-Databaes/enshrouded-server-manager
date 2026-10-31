/* Mirrors the serde types in `src-tauri/src/server/runtime.rs`. */

export type RuntimePhase = "stopped" | "starting" | "running" | "stopping";

export type ExitReason = "requested" | "forced" | "unexpected";

export type ExitInfo = {
  reason: ExitReason;
  code: number | null;
  /** Unix ms. */
  at: number;
  ranForMs: number;
};

export type Usage = {
  /** Share of the whole machine's CPU, 0–100. */
  cpuPercent: number;
  memoryBytes: number;
};

export type QueryInfo = {
  name: string;
  version: string;
  players: number;
  maxPlayers: number;
};

/** From the server's console when it says; otherwise from queries, which
 * only give names (if that). */
export type OnlinePlayer = {
  name: string | null;
  /** 64-bit, so kept as text. */
  steamId: string | null;
  /** The server's handle for the player this session, e.g. "0(0)". */
  handle: string | null;
  /** Unix ms. */
  joinedAt: number;
};

export type RuntimeStatus = {
  /** Increases with every change; older updates are ignored. */
  revision: number;
  phase: RuntimePhase;
  pid: number | null;
  /** Unix ms. */
  startedAt: number | null;
  /** When the server first answered a query (unix ms). */
  onlineAt: number | null;
  stopRequestedAt: number | null;
  queryAddress: string | null;
  /** `false` when a running server has stopped answering queries. */
  responding: boolean;
  usage: Usage | null;
  totalMemoryBytes: number;
  query: QueryInfo | null;
  /** Can briefly disagree with `query.players`: queries lag joins. */
  players: OnlinePlayer[];
  lastExit: ExitInfo | null;
  /** A server from the same folder that the manager didn't start. */
  externalPid: number | null;
};

export type LineKind = "output" | "info" | "error";

export type LogLine = {
  seq: number;
  /** Unix ms. */
  at: number;
  kind: LineKind;
  text: string;
};

export type PlayerSample = {
  /** Unix seconds. */
  at: number;
  players: number;
};
