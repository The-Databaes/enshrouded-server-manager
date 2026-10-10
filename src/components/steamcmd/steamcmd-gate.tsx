import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { SteamCmdSetup } from "@/components/steamcmd/steamcmd-setup";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSteamCmd } from "@/hooks/use-steamcmd";

const FullScreen = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-shroud-mist p-6 text-center">
    <LogoMark tile className="size-14 rounded-xl shadow-glow-flame" />
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

  if (!status && loadError) {
    return (
      <FullScreen>
        <div className="max-w-md space-y-1">
          <p className="flex items-center justify-center gap-2 font-medium text-ember">
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
