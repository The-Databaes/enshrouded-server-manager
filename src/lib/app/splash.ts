import { invoke, isTauri } from "@tauri-apps/api/core";

/** How far the window has got, shown on the splash (src-tauri/src/splash.rs). */
export type SplashStage = "interface" | "steamcmd" | "server";

/** Tell the splash the window got a step further. No-op outside Tauri. */
export const reportSplashStage = (stage: SplashStage) => {
  if (isTauri()) void invoke("splash_progress", { stage }).catch(() => {});
};

/** The first real screen is ready: swap the splash for this window. */
export const finishSplash = () => {
  if (isTauri()) void invoke("splash_ready").catch(() => {});
};
