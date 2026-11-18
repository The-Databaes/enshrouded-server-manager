import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { UpdateDialog } from "@/components/updater/update-dialog";
import { useServerActions, useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { UpdateStoreContext, useUpdater } from "@/hooks/use-updater";
import {
  createUpdateStore,
  isNewerVersion,
  shouldAnnounce,
  type UpdateStore,
} from "@/lib/app/update-store";
import { releaseUrl, updaterApi } from "@/lib/app/updater-api";

/** Long enough for the app to be up and the splash gone: a check at startup
 * mustn't compete with loading the server's state. */
const FIRST_CHECK_MS = 15_000;
/** Then every so often while the manager stays open (it often runs for days). */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
/** The "updated" note waits for the window to have appeared. */
const UPDATED_NOTE_DELAY_MS = 3000;

const browserStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/**
 * The manager's own updates: checks in the background, announces a new
 * version once, and hosts the update dialog that every entry point opens.
 */
export const UpdaterProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [store] = useState(() =>
    createUpdateStore(updaterApi(), browserStorage()),
  );

  return (
    <UpdateStoreContext.Provider value={store}>
      {children}
      <Background store={store} />
      <ResumeServer store={store} />
      <UpdateDialog />
    </UpdateStoreContext.Provider>
  );
};

const Background = ({ store }: { store: UpdateStore }) => {
  const autoCheck = useUpdater((s) => s.autoCheck);
  const dialogOpen = useUpdater((s) => s.dialogOpen);
  const announced = useRef(new Set<string>());

  // Once the dialog is open, the "new version" toast has done its job.
  useEffect(() => {
    if (!dialogOpen) return;
    for (const version of announced.current) toast.dismiss(`update-${version}`);
  }, [dialogOpen]);

  // After an update: say so once, with a way to read what changed.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    void store
      .loadVersion()
      .then(({ current, previous }) => {
        if (!previous || !isNewerVersion(current, previous)) return;
        timer = setTimeout(
          () =>
            toast.success(`Updated to version ${current}`, {
              id: `updated-${current}`,
              description: "The manager restarted on the new version.",
              duration: 10_000,
              action: {
                label: "What's new",
                onClick: () =>
                  void store.openUrl(releaseUrl(current)).catch(() => {}),
              },
            }),
          UPDATED_NOTE_DELAY_MS,
        );
      })
      .catch(() => {});
    return () => clearTimeout(timer);
  }, [store]);

  useEffect(() => {
    if (!autoCheck) return;
    const run = async () => {
      const result = await store.check();
      const { skippedVersion, dialogOpen } = store.getState();
      if (result.outcome !== "available" || dialogOpen) return;
      if (!shouldAnnounce(result.update, skippedVersion, announced.current))
        return;
      announced.current.add(result.update.version);
      toast(`Version ${result.update.version} is available`, {
        id: `update-${result.update.version}`,
        description: "See what's new, then update when it suits you.",
        duration: 12_000,
        action: { label: "See what's new", onClick: store.openDialog },
      });
    };
    // Back online after a check that couldn't get through: try again then,
    // rather than waiting hours for the next round.
    const onOnline = () => {
      if (store.getState().lastCheck?.error?.kind === "updateOffline")
        void run();
    };
    const first = setTimeout(() => void run(), FIRST_CHECK_MS);
    const every = setInterval(() => void run(), CHECK_EVERY_MS);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      window.removeEventListener("online", onOnline);
    };
  }, [autoCheck, store]);

  return null;
};

/** Read once per app run: StrictMode runs effects twice in development, and
 * the request is cleared as it's read. */
let resumeRequested: boolean | null = null;

/** After an update that stopped the server, start it again if asked to. */
const ResumeServer = ({ store }: { store: UpdateStore }) => {
  const [pending, setPending] = useState(false);
  const status = useServerRuntime((s) => s.status);
  const steamcmdReady = useSteamCmd().status?.availability === "ready";
  const { start } = useServerActions();

  useEffect(() => {
    resumeRequested ??= store.takeResumeRequest();
    setPending(resumeRequested);
  }, [store]);

  useEffect(() => {
    if (!pending || !status || !steamcmdReady) return;
    setPending(false);
    resumeRequested = false;
    // Someone may have started it already, or another copy is running.
    if (status.phase !== "stopped" || status.externalPid !== null) return;
    void start().then((ok) => {
      if (ok)
        toast.success("Starting the server again", {
          description: "As you asked before the update.",
        });
    });
  }, [pending, status, steamcmdReady, start]);

  return null;
};
