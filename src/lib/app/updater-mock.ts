/*
 * Browser-only stand-in for the manager's updater (see `steamcmd/mock.ts`).
 * Seed what the check finds with
 * `?mockUpdate=available|none|norelease|offline|badsig|nosize`:
 *
 *   available  0.2.0 is out; installing "restarts" into it
 *   badsig     0.2.0 is out, but its download fails verification
 *   nosize     0.2.0 is out, and its download has no known size
 *   norelease  nothing has been published yet
 *   offline    the update server can't be reached
 *   none       (the default) this is the latest version
 */
import type {
  AvailableUpdate,
  InstallEvent,
  UpdaterApi,
} from "@/lib/app/updater-api";
import { browserMockRuntimeApi } from "@/lib/server/runtime-mock";
import type { AppError } from "@/lib/steamcmd/types";

const CURRENT = "0.1.0";
const NEXT = "0.2.0";
const SIZE = 9_437_184 * 4.2;
/** Set when a mock install "restarts" the app, so it comes back newer. */
const RESTARTED_KEY = "esm-mock-updated";

const NOTES = `## What's new

* **Updates from inside the manager.** It checks every few hours and tells you when a new version is out. Nothing installs without asking.
* A calmer splash screen, and a sharper icon in the title bar and taskbar.
* The dashboard groups its figures into panels, with chart times on the hour.

## Fixes

* The manager no longer closes at once when the splash screen loads quickly.
* Backups shows an honest empty state instead of a timeline that looked real.

**Full Changelog**: https://github.com/The-Databaes/enshrouded-server-manager/compare/v0.1.0...v0.2.0`;

const mode = () => {
  if (typeof window === "undefined") return "none";
  return (
    new URLSearchParams(window.location.search).get("mockUpdate") ?? "none"
  );
};

const restarted = () => {
  try {
    return sessionStorage.getItem(RESTARTED_KEY) === "1";
  } catch {
    return false;
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fail = (kind: AppError["kind"], message: string): AppError => ({
  kind,
  message,
});

export const browserMockUpdaterApi: UpdaterApi = {
  currentVersion: async () => (restarted() ? NEXT : CURRENT),

  check: async () => {
    await sleep(900);
    if (restarted()) return null;
    switch (mode()) {
      case "available":
      case "badsig":
      case "nosize":
        return {
          version: NEXT,
          currentVersion: CURRENT,
          date: Date.now() - 2 * 86_400_000,
          notes: NOTES,
        } satisfies AvailableUpdate;
      case "norelease":
        throw fail(
          "updateNoRelease",
          "No release of the manager has been published yet.",
        );
      case "offline":
        throw fail(
          "updateOffline",
          "Couldn't reach the update server. Check your internet connection, then try again.",
        );
      default:
        return null;
    }
  },

  install: async (onEvent: (event: InstallEvent) => void) => {
    const known = mode() !== "nosize";
    let downloaded = 0;
    while (downloaded < SIZE) {
      await sleep(100);
      downloaded = Math.min(SIZE, downloaded + SIZE / 45);
      onEvent({
        event: "downloading",
        data: { downloaded, total: known ? SIZE : null },
      });
    }
    await sleep(300);
    if (mode() === "badsig") {
      throw fail(
        "updateVerification",
        "The download didn't match its signature, so it wasn't installed. Your current version is untouched.",
      );
    }
    onEvent({ event: "verified" });
    await sleep(500);
    if ((await browserMockRuntimeApi.status()).phase !== "stopped") {
      onEvent({ event: "stoppingServer" });
      await browserMockRuntimeApi.stop();
      await sleep(2200);
    }
    onEvent({ event: "installing" });
    await sleep(1800);
    try {
      sessionStorage.setItem(RESTARTED_KEY, "1");
    } catch {}
    window.location.reload();
    await new Promise(() => {});
  },

  openUrl: async (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
};
