/* Mirrors the serde types in `src-tauri/src/steamcmd`. */

export type Availability = "notConfigured" | "ready" | "missing";

export type SteamCmdStatus = {
  availability: Availability;
  /** Full path to steamcmd.exe, once configured. */
  executable: string | null;
  /** True when the app downloaded SteamCMD and may update/delete it. */
  managed: boolean;
  /** Unix seconds of the last install/self-update run by the app. */
  lastUpdatedAt: number | null;
  /** Where "Download it for me" installs to. */
  managedDir: string;
  busy: boolean;
  canDownload: boolean;
};

export type PathCheck = {
  executable: string | null;
  error: string | null;
};

export type InstallStage = "downloading" | "extracting" | "updating";

export type SteamCmdEvent =
  | { event: "stage"; data: { stage: InstallStage } }
  | { event: "download"; data: { received: number; total: number | null } }
  | {
      event: "progress";
      data: {
        percent: number;
        /** What SteamCMD says it's doing, e.g. "downloading". */
        label: string | null;
        current: number | null;
        total: number | null;
      };
    }
  | {
      event: "downloadPlan";
      /**
       * From SteamCMD's content log: an app_update will download
       * `downloadTotal` bytes (compressed) to write `stageTotal` bytes of
       * files, which is what `progress` events count.
       */
      data: { downloadTotal: number; stageTotal: number };
    }
  | { event: "log"; data: { line: string } }
  /** The line SteamCMD is still writing; replaced by the next `log`. */
  | { event: "partial"; data: { line: string } };

export type AppError = {
  kind:
    | "io"
    | "http"
    | "archive"
    | "config"
    | "tauri"
    | "invalidPath"
    | "busy"
    | "cancelled"
    | "unsupported"
    | "steamcmd"
    | "unknown";
  message: string;
};
