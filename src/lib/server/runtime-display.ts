import type { RuntimeStatus } from "@/lib/server/runtime-types";

export type StatusTone = "success" | "info" | "warning" | "neutral";

export type PhaseView = {
  /** One word, e.g. "Online". */
  label: string;
  tone: StatusTone;
};

/** How the server's state reads in the UI. */
export const phaseView = (status: RuntimeStatus | null): PhaseView => {
  switch (status?.phase) {
    case "starting":
      return { label: "Starting", tone: "info" };
    case "running":
      return status.responding
        ? { label: "Online", tone: "success" }
        : { label: "Not responding", tone: "warning" };
    case "stopping":
      return { label: "Stopping", tone: "warning" };
    default:
      return { label: "Offline", tone: "neutral" };
  }
};

/** The server process is up (starting, running or stopping). */
export const isActive = (status: RuntimeStatus | null) =>
  Boolean(status && status.phase !== "stopped");

/** e.g. "2d 14h", "3h 06m", "12m", "45s". */
export const formatDuration = (ms: number) => {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(secs / 86_400);
  const hours = Math.floor((secs % 86_400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${String(mins).padStart(2, "0")}m`;
  if (mins) return `${mins}m`;
  return `${secs}s`;
};

/** "HH:MM:SS" in local time, for console timestamps. */
export const formatClock = (ms: number) => {
  // Runs for every console line, so no Intl here: it's far slower.
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** How long the server process has been up. */
export const uptimeMs = (status: RuntimeStatus, now: number) =>
  status.startedAt === null ? 0 : now - status.startedAt;

/** Crash exit codes are Windows status codes, recognisable only in hex
 * (e.g. 0xC0000005, an access violation). */
export const formatExitCode = (code: number) =>
  code >= 0x8000_0000
    ? `${code} (0x${code.toString(16).toUpperCase().padStart(8, "0")})`
    : String(code);
