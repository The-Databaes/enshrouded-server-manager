import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ServerRuntimeContext,
  useServerRuntime,
} from "@/hooks/use-server-runtime";
import { serverApi } from "@/lib/server/api";
import { runtimeApi } from "@/lib/server/runtime-api";
import { createRuntimeStore } from "@/lib/server/runtime-store";
import { toAppError } from "@/lib/steamcmd/api";

/** Quitting can be forced once saving has taken this long. */
const OFFER_FORCE_QUIT_AFTER_MS = 15_000;

/**
 * Shares the running server's live state with the whole app (one backend
 * subscription for every page), and asks before the window closes while
 * the server runs.
 */
export const ServerRuntimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [store] = useState(() =>
    createRuntimeStore(
      runtimeApi(),
      async () => (await serverApi().status()).settings,
    ),
  );
  useEffect(() => store.connect(), [store]);

  return (
    <ServerRuntimeContext.Provider value={store}>
      {children}
      <QuitDialog />
    </ServerRuntimeContext.Provider>
  );
};

type QuitStage = "closed" | "asking" | "stopping";

/** Shown when the window is closed while the server is running. */
const QuitDialog = () => {
  const [stage, setStage] = useState<QuitStage>("closed");
  const [canForce, setCanForce] = useState(false);
  const players = useServerRuntime((s) => s.status?.query?.players ?? 0);
  const phase = useServerRuntime((s) => s.status?.phase);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void runtimeApi()
      .onCloseRequested(() => setStage((s) => (s === "closed" ? "asking" : s)))
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (stage !== "stopping") return;
    const id = setTimeout(() => setCanForce(true), OFFER_FORCE_QUIT_AFTER_MS);
    return () => clearTimeout(id);
  }, [stage]);

  const quit = async (force: boolean) => {
    setStage("stopping");
    try {
      await runtimeApi().quit(force);
    } catch (error) {
      setStage("closed");
      toast.error("Couldn't quit", { description: toAppError(error).message });
    }
  };

  return (
    <AlertDialog
      open={stage !== "closed"}
      onOpenChange={(open) => {
        if (!open && stage === "asking") setStage("closed");
      }}
    >
      <AlertDialogContent>
        {stage === "stopping" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Spinner className="text-ember" />
                Stopping the server…
              </AlertDialogTitle>
              <AlertDialogDescription>
                {phase === "stopped"
                  ? "Closing the manager."
                  : "It's saving the world. The manager closes as soon as it's done."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {canForce && phase !== "stopped" ? (
              <AlertDialogFooter>
                <Button variant="destructive" onClick={() => void quit(true)}>
                  Force quit (lose unsaved progress)
                </Button>
              </AlertDialogFooter>
            ) : null}
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>The server is still running</AlertDialogTitle>
              <AlertDialogDescription>
                {players > 0
                  ? `Quitting stops the server and disconnects ${players === 1 ? "the 1 player" : `all ${players} players`} online. `
                  : "Quitting stops the server. "}
                It saves the world first, which can take a moment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep running</AlertDialogCancel>
              <Button variant="destructive" onClick={() => void quit(false)}>
                Stop server and quit
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
