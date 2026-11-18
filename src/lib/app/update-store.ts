import type {
  AvailableUpdate,
  InstallEvent,
  UpdaterApi,
} from "@/lib/app/updater-api";
import { toAppError } from "@/lib/steamcmd/api";
import type { AppError } from "@/lib/steamcmd/types";

export type InstallStep =
  | "starting"
  | "downloading"
  | "verified"
  | "stoppingServer"
  | "installing";

export type InstallProgress = {
  step: InstallStep;
  downloaded: number;
  /** `null` when the server didn't say how big the download is. */
  total: number | null;
  /** Bytes per second, smoothed; `null` until there are two readings. */
  rate: number | null;
  /** When `downloaded` was last read (ms). */
  sampledAt: number;
  /** The server was stopped as part of this install. */
  stoppedServer: boolean;
};

export type UpdateState = {
  /** The version running now; `null` until known. */
  currentVersion: string | null;
  /** A newer version, from the last check that found one. */
  update: AvailableUpdate | null;
  checking: boolean;
  /** How the last finished check went. */
  lastCheck: { at: number; error: AppError | null } | null;
  /** Set while an update is being installed. */
  install: InstallProgress | null;
  /** Why the last install attempt failed. */
  installError: AppError | null;
  /** That failed install had already stopped the server. */
  failedAfterStoppingServer: boolean;
  dialogOpen: boolean;
  /** A version the user chose to skip: not announced again. */
  skippedVersion: string | null;
  /** Check on startup and every few hours. */
  autoCheck: boolean;
  /** Start the server again once the updated manager is back. */
  resumeServer: boolean;
};

export const INITIAL_UPDATE_STATE: UpdateState = {
  currentVersion: null,
  update: null,
  checking: false,
  lastCheck: null,
  install: null,
  installError: null,
  failedAfterStoppingServer: false,
  dialogOpen: false,
  skippedVersion: null,
  autoCheck: true,
  resumeServer: true,
};

/** What to tell the user about updates, in order of what matters most. */
export type UpdateStatus =
  | "installing"
  | "checking"
  | "available"
  | "upToDate"
  | "noRelease"
  | "offline"
  | "failed"
  | "unknown";

export const updateStatus = (s: UpdateState): UpdateStatus => {
  if (s.install) return "installing";
  if (s.checking) return "checking";
  if (s.update) return "available";
  if (!s.lastCheck) return "unknown";
  switch (s.lastCheck.error?.kind) {
    case undefined:
      return "upToDate";
    case "updateNoRelease":
      return "noRelease";
    case "updateOffline":
      return "offline";
    default:
      return "failed";
  }
};

/** How much of the smoothed rate carries over to the next reading. */
const RATE_MEMORY = 0.75;

/** Fold one event from the backend into the install's progress. */
export const applyInstallEvent = (
  progress: InstallProgress,
  event: InstallEvent,
  now: number,
): InstallProgress => {
  switch (event.event) {
    case "downloading": {
      const { downloaded, total } = event.data;
      const seconds = (now - progress.sampledAt) / 1000;
      const gained = downloaded - progress.downloaded;
      let rate = progress.rate;
      if (progress.step === "downloading" && seconds > 0 && gained >= 0) {
        const instant = gained / seconds;
        rate =
          rate === null
            ? instant
            : rate * RATE_MEMORY + instant * (1 - RATE_MEMORY);
      }
      return {
        ...progress,
        step: "downloading",
        downloaded,
        total,
        rate,
        sampledAt: now,
      };
    }
    case "verified":
      return {
        ...progress,
        step: "verified",
        downloaded: progress.total ?? progress.downloaded,
      };
    case "stoppingServer":
      return { ...progress, step: "stoppingServer", stoppedServer: true };
    case "installing":
      return { ...progress, step: "installing" };
  }
};

/** Share of the download done (0–100), or `null` when its size is unknown. */
export const downloadPercent = (p: InstallProgress) =>
  p.total ? Math.min(100, (p.downloaded / p.total) * 100) : null;

/** Time left in the download (ms), once there's enough to estimate it. */
export const downloadEtaMs = (p: InstallProgress) => {
  if (!p.total || !p.rate || p.rate <= 0 || p.step !== "downloading")
    return null;
  return ((p.total - p.downloaded) / p.rate) * 1000;
};

/** `a` is a later version than `b` (dotted numbers; a leading `v` and any
 * `-pre`/`+build` suffix are ignored). */
export const isNewerVersion = (a: string, b: string) => {
  const parts = (v: string) =>
    v
      .replace(/^v/, "")
      .split(/[-+]/)[0]
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
};

/** Worth telling the user about: not skipped, not already announced. */
export const shouldAnnounce = (
  update: AvailableUpdate | null,
  skippedVersion: string | null,
  announced: ReadonlySet<string>,
) =>
  update !== null &&
  update.version !== skippedVersion &&
  !announced.has(update.version);

/** Remembered between sessions. Every access tolerates storage being off. */
export const STORAGE_KEYS = {
  skipped: "esm-update-skipped",
  autoCheck: "esm-update-auto",
  lastVersion: "esm-last-version",
  resumeServer: "esm-update-resume-server",
  /** When the server was stopped for an install that asked to resume it. */
  resumeAt: "esm-update-resume-at",
} as const;

/** A request to start the server again is only honoured this soon after
 * the server was stopped for the update: never out of the blue days later. */
export const RESUME_WITHIN_MS = 30 * 60 * 1000;

export type KeyValueStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const read = (storage: KeyValueStorage | null, key: string) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const write = (
  storage: KeyValueStorage | null,
  key: string,
  value: string | null,
) => {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {}
};

export type CheckResult =
  | { outcome: "available"; update: AvailableUpdate }
  | { outcome: "upToDate" }
  | { outcome: "failed"; error: AppError };

/**
 * The manager's own updates, shared by the sidebar, the settings page, the
 * command palette and the update dialog. One check runs at a time however
 * many places ask, and an install can't be started twice.
 */
export const createUpdateStore = (
  api: UpdaterApi,
  storage: KeyValueStorage | null,
) => {
  let state: UpdateState = {
    ...INITIAL_UPDATE_STATE,
    skippedVersion: read(storage, STORAGE_KEYS.skipped),
    autoCheck: read(storage, STORAGE_KEYS.autoCheck) !== "0",
    resumeServer: read(storage, STORAGE_KEYS.resumeServer) !== "0",
  };
  const listeners = new Set<() => void>();
  let inFlight: Promise<CheckResult> | null = null;

  const set = (change: (s: UpdateState) => UpdateState) => {
    const next = change(state);
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };

  /** The version running now, and the one that ran last time (if any). */
  const loadVersion = async () => {
    const current = await api.currentVersion();
    const previous = read(storage, STORAGE_KEYS.lastVersion);
    write(storage, STORAGE_KEYS.lastVersion, current);
    set((s) => ({ ...s, currentVersion: current }));
    return { current, previous };
  };

  const check = (): Promise<CheckResult> => {
    if (inFlight) return inFlight;
    if (state.install) {
      return Promise.resolve(
        state.update
          ? { outcome: "available", update: state.update }
          : { outcome: "upToDate" },
      );
    }
    set((s) => ({ ...s, checking: true }));
    inFlight = (async (): Promise<CheckResult> => {
      try {
        const update = await api.check();
        set((s) => ({
          ...s,
          checking: false,
          update,
          lastCheck: { at: Date.now(), error: null },
          currentVersion: update?.currentVersion ?? s.currentVersion,
        }));
        return update
          ? { outcome: "available", update }
          : { outcome: "upToDate" };
      } catch (raw) {
        const error = toAppError(raw);
        // A failed check doesn't make a known update go away: it's still
        // out there, and installing it will say if it can't be reached.
        set((s) => ({
          ...s,
          checking: false,
          lastCheck: { at: Date.now(), error },
        }));
        return { outcome: "failed", error };
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  const install = async () => {
    if (!state.update || state.install) return;
    set((s) => ({
      ...s,
      dialogOpen: true,
      installError: null,
      failedAfterStoppingServer: false,
      install: {
        step: "starting",
        downloaded: 0,
        total: null,
        rate: null,
        sampledAt: Date.now(),
        stoppedServer: false,
      },
    }));
    try {
      await api.install((event) => {
        if (event.event === "stoppingServer" && state.resumeServer) {
          write(storage, STORAGE_KEYS.resumeAt, String(Date.now()));
        }
        set((s) =>
          s.install
            ? { ...s, install: applyInstallEvent(s.install, event, Date.now()) }
            : s,
        );
      });
    } catch (raw) {
      // Still running the old version: the dialog offers to start the
      // server again, so the next launch mustn't do it too.
      write(storage, STORAGE_KEYS.resumeAt, null);
      set((s) => ({
        ...s,
        install: null,
        installError: toAppError(raw),
        failedAfterStoppingServer: s.install?.stoppedServer ?? false,
      }));
    }
  };

  /** The dialog can't be dismissed once the server is stopping. */
  const isCommitted = () =>
    state.install?.step === "stoppingServer" ||
    state.install?.step === "installing";

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    loadVersion,
    check,
    install,
    isCommitted,
    openDialog: () => set((s) => ({ ...s, dialogOpen: true })),
    closeDialog: () => {
      if (isCommitted()) return;
      set((s) => ({ ...s, dialogOpen: false, installError: null }));
    },
    skip: (version: string) => {
      write(storage, STORAGE_KEYS.skipped, version);
      set((s) => ({
        ...s,
        skippedVersion: version,
        dialogOpen: false,
        installError: null,
      }));
    },
    /** Announce the skipped version again. */
    unskip: () => {
      write(storage, STORAGE_KEYS.skipped, null);
      set((s) => ({ ...s, skippedVersion: null }));
    },
    setResumeServer: (on: boolean) => {
      write(storage, STORAGE_KEYS.resumeServer, on ? "1" : "0");
      set((s) => ({ ...s, resumeServer: on }));
    },
    /** Whether an update stopped the server and asked for it back. Asking
     * clears the request, so it's acted on once. */
    takeResumeRequest: (now = Date.now()) => {
      const at = Number(read(storage, STORAGE_KEYS.resumeAt));
      write(storage, STORAGE_KEYS.resumeAt, null);
      return at > 0 && now - at >= 0 && now - at < RESUME_WITHIN_MS;
    },
    setAutoCheck: (on: boolean) => {
      write(storage, STORAGE_KEYS.autoCheck, on ? "1" : "0");
      set((s) => ({ ...s, autoCheck: on }));
    },
    openUrl: (url: string) => api.openUrl(url),
  };
};

export type UpdateStore = ReturnType<typeof createUpdateStore>;
