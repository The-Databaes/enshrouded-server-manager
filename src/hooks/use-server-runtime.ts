import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import type { RuntimeApi } from "@/lib/server/runtime-api";
import {
  INITIAL_STATE,
  type RuntimeState,
  type RuntimeStore,
} from "@/lib/server/runtime-store";
import type { RuntimeStatus } from "@/lib/server/runtime-types";
import type { AppError } from "@/lib/steamcmd/types";

export const ServerRuntimeContext = createContext<RuntimeStore | null>(null);

const useRuntimeStore = () => {
  const store = useContext(ServerRuntimeContext);
  if (!store) {
    throw new Error(
      "useServerRuntime must be used inside <ServerRuntimeProvider>",
    );
  }
  return store;
};

/**
 * A slice of the running server's state. Re-renders only when the selected
 * value changes, so select the narrowest thing you need (and never build a
 * new object in the selector).
 */
export const useServerRuntime = <T>(
  selector: (state: RuntimeState) => T,
): T => {
  const store = useRuntimeStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(INITIAL_STATE),
  );
};

export const useRuntimeStatus = () => useServerRuntime((s) => s.status);

/** Shown when an action fails, by action. */
const FAILURE_TITLES = {
  start: "Couldn't start the server",
  stop: "Couldn't stop the server",
  restart: "Couldn't restart the server",
  kill: "Couldn't force the server to close",
  killExternal: "Couldn't close the other server",
} as const;

export type RuntimeAction = keyof typeof FAILURE_TITLES;

/** Start/stop/… commands. Each resolves `true` on success; failures are
 * reported with a toast. */
export const useServerActions = () => {
  const store = useRuntimeStore();
  return useMemo(() => {
    const run =
      (
        action: RuntimeAction,
        op: (api: RuntimeApi) => Promise<RuntimeStatus>,
      ) =>
      async () => {
        try {
          await store.run(op);
          return true;
        } catch (error) {
          toast.error(FAILURE_TITLES[action], {
            description: (error as AppError).message,
          });
          return false;
        }
      };
    return {
      start: run("start", (api) => api.start()),
      stop: run("stop", (api) => api.stop()),
      restart: run("restart", (api) => api.restart()),
      kill: run("kill", (api) => api.kill()),
      killExternal: (pid: number) =>
        run("killExternal", (api) => api.killExternal(pid))(),
      refreshSettings: store.refreshSettings,
    };
  }, [store]);
};
