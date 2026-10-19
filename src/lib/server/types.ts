/* Mirrors the serde types in `src-tauri/src/server/commands.rs`. */

export type InstallState = "notInstalled" | "installed" | "incomplete";

export type ServerStatus = {
  state: InstallState;
  appId: string;
  installDir: string | null;
  defaultInstallDir: string;
  buildId: string | null;
  sizeOnDisk: number | null;
  /** Unix seconds. */
  lastUpdatedAt: number | null;
  lastVerifiedAt: number | null;
  latestBuildId: string | null;
  lastCheckedAt: number | null;
  /** Known only after an update check. */
  updateAvailable: boolean | null;
  /** From the server's own `enshrouded_server.json`, once a folder is chosen. */
  settings: ServerSettings | null;
  /** When the world was last written to disk (unix seconds). */
  lastSavedAt: number | null;
};

/** `missing` until the server creates the file on its first start. */
export type SettingsFileState = "missing" | "ok" | "invalid";

/** Mirrors `src-tauri/src/server/settings.rs`. */
export type ServerSettings = {
  file: SettingsFileState;
  /** Why the file couldn't be read, when `file` is `invalid`. */
  problem: string | null;
  name: string;
  ip: string;
  queryPort: number;
  slotCount: number;
  saveDir: string;
  logDir: string;
};

export type FolderKind = "existingInstall" | "empty" | "notEmpty" | "invalid";

export type FolderCheck = {
  kind: FolderKind;
  message: string;
  buildId: string | null;
};
