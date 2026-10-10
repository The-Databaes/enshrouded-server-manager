import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { steamcmdApi, toAppError } from "@/lib/steamcmd/api";
import {
  applyEvent,
  finishTask,
  type SteamCmdTask,
  startTask,
  type TaskKind,
} from "@/lib/steamcmd/task";
import type {
  AppError,
  SteamCmdEvent,
  SteamCmdStatus,
} from "@/lib/steamcmd/types";

export type SteamCmdContextValue = {
  /** `null` until the first status call returns. */
  status: SteamCmdStatus | null;
  loadError: AppError | null;
  refresh: () => Promise<void>;
  /** The running (or most recent) download/update, for progress UI. */
  task: SteamCmdTask | null;
  /**
   * Run any SteamCMD job with live progress in `task`. Resolves to the job's
   * result, or `undefined` if it failed or was cancelled (see `task.error`).
   */
  runTask: <T>(
    kind: TaskKind,
    op: (onEvent: (e: SteamCmdEvent) => void) => Promise<T>,
  ) => Promise<T | undefined>;
  /** Each resolves `true` on success; failures land in `task.error`. */
  install: () => Promise<boolean>;
  update: () => Promise<boolean>;
  cancel: () => Promise<void>;
  dismissTask: () => void;
  /** Rejects with an `AppError` the caller should display. */
  adoptExisting: (path: string) => Promise<void>;
  forget: (deleteFiles: boolean) => Promise<void>;
};

export const SteamCmdContext = createContext<SteamCmdContextValue | null>(null);

export const useSteamCmd = () => {
  const value = useContext(SteamCmdContext);
  if (!value) {
    throw new Error("useSteamCmd must be used inside <SteamCmdProvider>");
  }
  return value;
};

/** State behind `<SteamCmdProvider>`; lives at the root so a running
 * download keeps reporting progress while the user navigates. */
export const useSteamCmdController = (): SteamCmdContextValue => {
  const [status, setStatus] = useState<SteamCmdStatus | null>(null);
  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [task, setTask] = useState<SteamCmdTask | null>(null);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await steamcmdApi().status());
      setLoadError(null);
    } catch (error) {
      setLoadError(toAppError(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runTask = useCallback(
    async <T>(
      kind: TaskKind,
      op: (onEvent: (e: SteamCmdEvent) => void) => Promise<T>,
    ): Promise<T | undefined> => {
      if (running.current) return undefined;
      running.current = true;
      setTask(startTask(kind));
      try {
        const result = await op((event) =>
          setTask((t) => t && applyEvent(t, event)),
        );
        setTask((t) => t && finishTask(t, null));
        return result;
      } catch (error) {
        setTask((t) => t && finishTask(t, toAppError(error)));
        return undefined;
      } finally {
        running.current = false;
      }
    },
    [],
  );

  const runSteamCmdTask = useCallback(
    async (
      kind: TaskKind,
      op: (onEvent: (e: SteamCmdEvent) => void) => Promise<SteamCmdStatus>,
    ) => {
      const next = await runTask(kind, op);
      if (next) setStatus(next);
      else await refresh();
      return Boolean(next);
    },
    [runTask, refresh],
  );

  const install = useCallback(
    () =>
      runSteamCmdTask("install", (onEvent) => steamcmdApi().install(onEvent)),
    [runSteamCmdTask],
  );
  const update = useCallback(
    () => runSteamCmdTask("update", (onEvent) => steamcmdApi().update(onEvent)),
    [runSteamCmdTask],
  );
  const cancel = useCallback(() => steamcmdApi().cancel(), []);
  const dismissTask = useCallback(() => {
    if (!running.current) setTask(null);
  }, []);

  const adoptExisting = useCallback(async (path: string) => {
    try {
      setStatus(await steamcmdApi().adoptExisting(path));
      setTask(null);
    } catch (error) {
      throw toAppError(error);
    }
  }, []);

  const forget = useCallback(async (deleteFiles: boolean) => {
    try {
      setStatus(await steamcmdApi().forget(deleteFiles));
      setTask(null);
    } catch (error) {
      throw toAppError(error);
    }
  }, []);

  return {
    status,
    loadError,
    refresh,
    task,
    runTask,
    install,
    update,
    cancel,
    dismissTask,
    adoptExisting,
    forget,
  };
};
