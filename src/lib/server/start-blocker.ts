import type { RuntimeStatus } from "@/lib/server/runtime-types";
import type { ServerStatus } from "@/lib/server/types";
import type { SteamCmdTask } from "@/lib/steamcmd/task";

/** Why the server can't be started right now, or `null` if it can. */
export const startBlocker = (
  files: ServerStatus | null,
  task: SteamCmdTask | null,
  runtime: RuntimeStatus | null,
): string | null => {
  if (!files || files.state === "notInstalled")
    return "Install the server first, on the Server files page.";
  if (files.state === "incomplete")
    return "The server install didn't finish. Resume it on the Server files page.";
  if (task?.phase === "running")
    return "SteamCMD is busy. Start the server once it has finished.";
  if (runtime?.externalPid != null)
    return "A copy of this server is already running outside the manager.";
  return null;
};
