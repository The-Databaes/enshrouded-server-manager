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
};

export type FolderKind = "existingInstall" | "empty" | "notEmpty" | "invalid";

export type FolderCheck = {
  kind: FolderKind;
  message: string;
  buildId: string | null;
};
