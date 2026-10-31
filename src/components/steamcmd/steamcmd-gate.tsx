import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { FlameBeacon } from "@/components/brand/flame-beacon";
import { SteamCmdSetup } from "@/components/steamcmd/steamcmd-setup";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSteamCmd } from "@/hooks/use-steamcmd";

/** How long the first status call may take before the screen says so. */
const SLOW_START_MS = 8000;

const FullScreen = ({
  failed = false,
  children,
}: {
  failed?: boolean;
  children: React.ReactNode;
}) => (
  <div className="flex min-h-full animate-page-in flex-col items-center justify-center gap-5 p-6 text-center">
    <FlameBeacon state={failed ? "faltering" : "kindling"} />
    {children}
  </div>
);

/**
 * Nothing else in the manager works without SteamCMD, so until it's set up
 * (or if it later goes missing) the whole window shows the setup screen
 * instead of the app.
 */
export const SteamCmdGate = ({ children }: { children: React.ReactNode }) => {
  const { status, loadError, refresh, dismissTask } = useSteamCmd();
  const ready = status?.availability === "ready";

  // Once setup has been shown, keep it up after SteamCMD becomes ready so the
  // user sees the success screen and continues when they're ready.
  const [holdSetup, setHoldSetup] = useState(false);
  useEffect(() => {
    if (status && !ready) setHoldSetup(true);
  }, [status, ready]);

  // The first call normally answers at once. If it hasn't after a while,
  // say so instead of spinning forever.
  const waiting = !status && !loadError;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_START_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (!status && loadError) {
    return (
      <FullScreen failed>
        <div className="max-w-md space-y-1">
          <p className="flex items-center justify-center gap-2 font-medium text-destructive">
            <TriangleAlertIcon className="size-4" />
            Couldn't read the app's settings
          </p>
          <p className="text-sm text-muted-foreground">{loadError.message}</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          <RotateCcwIcon data-icon="inline-start" />
          Try again
        </Button>
      </FullScreen>
    );
  }

  if (!status && slow) {
    return (
      <FullScreen failed>
        <div className="max-w-md space-y-1.5">
          <p className="font-medium">
            The app's background service isn't answering
          </p>
          <p className="text-sm text-pretty text-muted-foreground">
            It normally replies at once. Try again, or reload the window. If it
            stays stuck, close the app completely (check Task Manager for a
            leftover copy) and open it again.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            <RotateCcwIcon data-icon="inline-start" />
            Try again
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Reload window
          </Button>
        </div>
      </FullScreen>
    );
  }

  if (!status) {
    return (
      <FullScreen>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Kindling the Flame…
        </p>
      </FullScreen>
    );
  }

  if (!ready || holdSetup) {
    return (
      <SteamCmdSetup
        status={status}
        onContinue={() => {
          dismissTask();
          setHoldSetup(false);
        }}
      />
    );
  }

  return children;
};
