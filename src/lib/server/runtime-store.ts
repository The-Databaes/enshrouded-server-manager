import type { RuntimeApi } from "@/lib/server/runtime-api";
import type { LogLine, RuntimeStatus } from "@/lib/server/runtime-types";
import type { ServerSettings } from "@/lib/server/types";
import { toAppError } from "@/lib/steamcmd/api";
import type { AppError } from "@/lib/steamcmd/types";

/** Same cap as the backend's buffer (`MAX_LOG_LINES` in runtime.rs). */
export const MAX_LOG_LINES = 5000;

export type RuntimeState = {
  /** `null` until the first status arrives. */
  status: RuntimeStatus | null;
  /** Console output, oldest first. */
  log: LogLine[];
  /** The server's own settings (name, port, …), when installed. */
  settings: ServerSettings | null;
  loadError: AppError | null;
};

export const INITIAL_STATE: RuntimeState = {
  status: null,
  log: [],
  settings: null,
  loadError: null,
};

/** Take `next` unless it's older than what we have (events can overtake
 * a command's reply). */
export const applyStatus = (
  current: RuntimeStatus | null,
  next: RuntimeStatus,
): RuntimeStatus =>
  current && next.revision < current.revision ? current : next;

/** Append lines not seen yet (by `seq`), keeping the newest
 * `MAX_LOG_LINES`. Returns `log` itself when nothing is new. */
export const appendLog = (log: LogLine[], lines: LogLine[]): LogLine[] => {
  const lastSeq = log.at(-1)?.seq ?? 0;
  const fresh = lines.filter((line) => line.seq > lastSeq);
  if (!fresh.length) return log;
  const next = log.concat(fresh);
  return next.length > MAX_LOG_LINES
    ? next.slice(next.length - MAX_LOG_LINES)
    : next;
};

/**
 * One shared copy of the running server's state, kept current by backend
 * events. Components read slices of it with `useSyncExternalStore`, so a
 * metrics update doesn't re-render the console and vice versa.
 */
export const createRuntimeStore = (
  api: RuntimeApi,
  loadSettings: () => Promise<ServerSettings | null>,
) => {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();

  const set = (change: (s: RuntimeState) => RuntimeState) => {
    const next = change(state);
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };

  const setStatus = (status: RuntimeStatus) => {
    const previous = state.status?.phase;
    set((s) => {
      const next = applyStatus(s.status, status);
      return next === s.status ? s : { ...s, status: next };
    });
    // The server writes its settings file on first start, and the user may
    // edit it while it's stopped: re-read when it starts or stops.
    if (previous && previous !== state.status?.phase) void refreshSettings();
  };

  const refreshSettings = async () => {
    try {
      const settings = await loadSettings();
      set((s) => ({ ...s, settings }));
    } catch {
      // Not worth interrupting anything for; the name just isn't shown.
    }
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Start following the backend. Returns a function that stops it. */
    connect: () => {
      let closed = false;
      const unlisteners: (() => void)[] = [];
      void (async () => {
        try {
          // Listen first, then read the snapshot, so nothing that happens
          // in between is missed (duplicates are dropped by seq/revision).
          const subscriptions = await Promise.all([
            api.onStatus(setStatus),
            api.onLog((lines) =>
              set((s) => {
                const log = appendLog(s.log, lines);
                return log === s.log ? s : { ...s, log };
              }),
            ),
          ]);
          unlisteners.push(...subscriptions);
          if (closed) return;
          const [status, log] = await Promise.all([api.status(), api.log()]);
          if (closed) return;
          set((s) => ({
            ...s,
            status: applyStatus(s.status, status),
            log: appendLog(log, s.log),
            loadError: null,
          }));
          await refreshSettings();
        } catch (error) {
          set((s) => ({ ...s, loadError: toAppError(error) }));
        }
      })();
      return () => {
        closed = true;
        for (const unlisten of unlisteners) unlisten();
      };
    },

    /** Run a command that returns the new status. Rejects with an
     * `AppError`. */
    run: async (op: (api: RuntimeApi) => Promise<RuntimeStatus>) => {
      try {
        setStatus(await op(api));
      } catch (error) {
        throw toAppError(error);
      }
    },

    refreshSettings,
  };
};

export type RuntimeStore = ReturnType<typeof createRuntimeStore>;
