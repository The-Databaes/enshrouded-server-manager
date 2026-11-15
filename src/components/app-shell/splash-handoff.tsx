import { useEffect, useRef } from "react";

import { useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { finishSplash, reportSplashStage } from "@/lib/app/splash";

/**
 * Give up waiting and show the window after this long, matching the
 * "background service isn't answering" notice in the SteamCMD gate.
 */
const GIVE_UP_MS = 8000;

/**
 * Reports the window's progress to the splash screen and swaps it for this
 * window once the first real screen can be drawn: SteamCMD's state is known
 * and, if it's ready, so is the server's.
 */
export const SplashHandoff = () => {
  const { status: steamcmd, loadError } = useSteamCmd();
  const runtimeKnown = useServerRuntime((s) => s.status !== null);
  const steamcmdKnown = steamcmd !== null || loadError !== null;
  const done = useRef(false);

  useEffect(() => {
    reportSplashStage("interface");
    const timer = setTimeout(() => {
      if (done.current) return;
      done.current = true;
      finishSplash();
    }, GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (steamcmdKnown) reportSplashStage("steamcmd");
  }, [steamcmdKnown]);

  useEffect(() => {
    if (done.current || !steamcmdKnown) return;
    const needsServer = steamcmd?.availability === "ready";
    if (needsServer && !runtimeKnown) return;
    if (needsServer) reportSplashStage("server");
    done.current = true;
    finishSplash();
  }, [steamcmdKnown, steamcmd?.availability, runtimeKnown]);

  return null;
};
