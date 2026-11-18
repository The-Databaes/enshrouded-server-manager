import { getVersion } from "@tauri-apps/api/app";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

import { browserMockUpdaterApi } from "@/lib/app/updater-mock";

/** Mirrors `AvailableUpdate` in `src-tauri/src/updater.rs`. */
export type AvailableUpdate = {
  version: string;
  currentVersion: string;
  /** When it was published (unix ms), if the release says. */
  date: number | null;
  /** Release notes, as Markdown. */
  notes: string | null;
};

/** Mirrors `InstallEvent` in `src-tauri/src/updater.rs`. */
export type InstallEvent =
  | {
      event: "downloading";
      data: { downloaded: number; total: number | null };
    }
  | { event: "verified" }
  | { event: "stoppingServer" }
  | { event: "installing" };

export type UpdaterApi = {
  /** The version running now. */
  currentVersion: () => Promise<string>;
  /** A newer version, or `null` when this is the latest. */
  check: () => Promise<AvailableUpdate | null>;
  /**
   * Download, verify and install the update found by the last `check`. In
   * the app this only returns on failure: success exits it and the
   * installer starts the new version.
   */
  install: (onEvent: (event: InstallEvent) => void) => Promise<void>;
  /** Open a web page in the browser. */
  openUrl: (url: string) => Promise<void>;
};

/** Where releases are published. Only GitHub's own pages are linked. */
export const RELEASES_URL =
  "https://github.com/The-Databaes/enshrouded-server-manager/releases";

export const releaseUrl = (version: string) =>
  `${RELEASES_URL}/tag/v${version.replace(/^v/, "")}`;

const tauriApi: UpdaterApi = {
  currentVersion: () => getVersion(),
  check: () => invoke("app_update_check"),
  install: (onEvent) => {
    const channel = new Channel<InstallEvent>();
    channel.onmessage = onEvent;
    return invoke("app_update_install", { onEvent: channel });
  },
  openUrl: (url) => openUrl(url),
};

/** The manager's own updates; a simulation outside Tauri (`?mockUpdate=`). */
export const updaterApi = (): UpdaterApi =>
  isTauri() ? tauriApi : browserMockUpdaterApi;
