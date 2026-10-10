import { useCallback, useEffect, useState } from "react";

import { useSteamCmd } from "@/hooks/use-steamcmd";
import { serverApi } from "@/lib/server/api";
import type { ServerStatus } from "@/lib/server/types";
import { toAppError } from "@/lib/steamcmd/api";
import { isServerTask, type TaskKind } from "@/lib/steamcmd/task";
import type { AppError, SteamCmdEvent } from "@/lib/steamcmd/types";

/**
 * Server-files status plus the SteamCMD jobs that act on it. The jobs run
 * through the shared SteamCMD task, so progress survives navigating away.
 */
export const useServer = () => {
  const { task, runTask } = useSteamCmd();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loadError, setLoadError] = useState<AppError | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await serverApi().status());
      setLoadError(null);
    } catch (error) {
      setLoadError(toAppError(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-read the files whenever a server job ends, including jobs started
  // before this page was (re)opened.
  const serverPhase = task && isServerTask(task.kind) ? task.phase : null;
  useEffect(() => {
    if (serverPhase && serverPhase !== "running") void refresh();
  }, [serverPhase, refresh]);

  const run = useCallback(
    async (
      kind: TaskKind,
      op: (onEvent: (e: SteamCmdEvent) => void) => Promise<ServerStatus>,
    ) => {
      const next = await runTask(kind, op);
      if (next) setStatus(next);
      return Boolean(next);
    },
    [runTask],
  );

  return {
    status,
    loadError,
    refresh,
    install: (path: string) =>
      run("serverInstall", (onEvent) => serverApi().install(path, onEvent)),
    update: () => run("serverUpdate", (onEvent) => serverApi().update(onEvent)),
    verify: () => run("serverVerify", (onEvent) => serverApi().verify(onEvent)),
    checkUpdate: () =>
      run("serverCheck", (onEvent) => serverApi().checkUpdate(onEvent)),
    forget: async () => {
      setStatus(await serverApi().forget());
    },
  };
};
