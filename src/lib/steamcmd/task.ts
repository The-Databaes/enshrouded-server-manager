import type {
  AppError,
  InstallStage,
  SteamCmdEvent,
} from "@/lib/steamcmd/types";

/** Everything that runs SteamCMD. Only one can run at a time. */
export type TaskKind =
  | "install"
  | "update"
  | "serverInstall"
  | "serverUpdate"
  | "serverVerify"
  | "serverCheck";
export type TaskPhase = "running" | "succeeded" | "failed" | "cancelled";

export const isServerTask = (kind: TaskKind) => kind.startsWith("server");

export type TaskProgress = {
  /** 0–100, or `null` when indeterminate. */
  percent: number | null;
  /** What's happening, e.g. "downloading" or "verifying install". */
  label: string | null;
  /** Bytes done / in total, when known. */
  current: number | null;
  total: number | null;
  /** Smoothed transfer rate in bytes per second, when it can be measured. */
  rate: number | null;
  /** When `current` was last sampled, for working out `rate`. */
  sampledAt: number | null;
};

/** UI state of the current (or last) SteamCMD job. */
export type SteamCmdTask = {
  kind: TaskKind;
  phase: TaskPhase;
  stage: InstallStage | null;
  progress: TaskProgress;
  log: string[];
  /** Unfinished last line (e.g. "Waiting for user info..." before "OK"). */
  partial: string | null;
  /** Real download vs. files-written sizes of the current app_update. */
  plan: { downloadTotal: number; stageTotal: number } | null;
  error: AppError | null;
};

/** Older lines are dropped so a long session can't grow memory forever. */
export const MAX_LOG_LINES = 5000;

const EMPTY_PROGRESS: TaskProgress = {
  percent: null,
  label: null,
  current: null,
  total: null,
  rate: null,
  sampledAt: null,
};

export const startTask = (kind: TaskKind): SteamCmdTask => ({
  kind,
  phase: "running",
  stage: null,
  progress: EMPTY_PROGRESS,
  log: [],
  partial: null,
  plan: null,
  error: null,
});

/** What SteamCMD is doing right now, in its own words. */
export const currentActivity = (task: SteamCmdTask) =>
  task.partial ?? task.log.at(-1) ?? null;

/** Fold a new byte count into the progress, updating the smoothed rate. */
const sample = (
  prev: TaskProgress,
  next: Omit<TaskProgress, "rate" | "sampledAt">,
  now: number,
): TaskProgress => {
  const sameJob = prev.label === next.label && prev.total === next.total;
  let rate = sameJob ? prev.rate : null;
  if (
    sameJob &&
    next.current !== null &&
    prev.current !== null &&
    prev.sampledAt !== null &&
    now > prev.sampledAt &&
    next.current >= prev.current
  ) {
    const instant =
      ((next.current - prev.current) * 1000) / (now - prev.sampledAt);
    rate = rate === null ? instant : rate * 0.6 + instant * 0.4;
  }
  return { ...next, rate, sampledAt: next.current === null ? null : now };
};

export const applyEvent = (
  task: SteamCmdTask,
  { event, data }: SteamCmdEvent,
  now = Date.now(),
): SteamCmdTask => {
  switch (event) {
    case "stage":
      return { ...task, stage: data.stage, progress: EMPTY_PROGRESS };
    case "download":
      return {
        ...task,
        progress: sample(
          task.progress,
          {
            percent: data.total ? (data.received / data.total) * 100 : null,
            label: "downloading installer",
            current: data.received,
            total: data.total,
          },
          now,
        ),
      };
    case "progress":
      return {
        ...task,
        progress: sample(
          task.progress,
          {
            ...data,
            // "[  0%] Checking for updates..." style lines carry no real
            // measurement; show those as indeterminate.
            percent:
              data.total === null && data.percent === 0 ? null : data.percent,
          },
          now,
        ),
      };
    case "log": {
      const log = [...task.log, data.line];
      return {
        ...task,
        partial: null,
        log: log.length > MAX_LOG_LINES ? log.slice(-MAX_LOG_LINES) : log,
      };
    }
    case "partial":
      return { ...task, partial: data.line };
    case "downloadPlan":
      return { ...task, plan: data };
  }
};

export const finishTask = (
  task: SteamCmdTask,
  error: AppError | null,
): SteamCmdTask => {
  if (!error) {
    return {
      ...task,
      phase: "succeeded",
      progress: { ...task.progress, percent: 100 },
    };
  }
  if (error.kind === "cancelled") return { ...task, phase: "cancelled" };
  return { ...task, phase: "failed", error };
};

/**
 * Sizes use 1024-based units labelled GB/MB, the same convention as Windows
 * Explorer, so they match what the user sees on disk.
 */
export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

/** e.g. "44.6 MB/s (374 Mbit/s)"; Mbit/s is decimal, as ISPs and Steam quote it. */
export const formatRate = (bytesPerSecond: number) =>
  `${formatBytes(bytesPerSecond)}/s (${Math.round((bytesPerSecond * 8) / 1e6)} Mbit/s)`;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Labels whose byte counts are real network transfer. */
const NETWORK_LABELS = new Set(["downloading installer", "Downloading update"]);

/**
 * One-line summary of the progress, or `null` if there's nothing measured.
 *
 * Careful with `app_update`'s "downloading" counter: it counts the
 * uncompressed bytes written, not what comes over the network (measured:
 * 3.7 GB downloaded for 8.8 GB counted). When SteamCMD's content log has
 * told us both sizes, the counter is scaled to network terms; otherwise it's
 * shown as data unpacked, with no speed.
 */
export const progressSummary = (task: SteamCmdTask): string | null => {
  const { percent, label, current, total, rate } = task.progress;
  if (percent === null && current === null) return null;
  const parts: (string | null)[] = [label ? capitalize(label) : null];
  const pct = percent === null ? null : `${Math.floor(percent)}%`;
  const plan = task.plan;

  if (label === "downloading" && current !== null) {
    if (plan && plan.downloadTotal > 0 && plan.stageTotal > 0) {
      const ratio = plan.downloadTotal / plan.stageTotal;
      const downloaded = Math.min(current * ratio, plan.downloadTotal);
      parts.push(
        `${formatBytes(downloaded)} of ${formatBytes(plan.downloadTotal)}`,
        rate ? `≈${formatRate(rate * ratio)}` : null,
        pct,
      );
    } else {
      parts.push(
        pct,
        total
          ? `${formatBytes(current)} of ${formatBytes(total)} unpacked`
          : null,
      );
    }
  } else {
    const isNetwork = label !== null && NETWORK_LABELS.has(label);
    parts.push(
      current !== null && total
        ? `${formatBytes(current)} of ${formatBytes(total)}`
        : null,
      isNetwork && rate ? formatRate(rate) : null,
      pct,
    );
  }
  return parts.filter(Boolean).join(" · ");
};

export type ProgressFigures = {
  /** 0–100, or `null` while there's nothing to measure. */
  percent: number | null;
  /** What's happening, capitalised ("Downloading", "Verifying install"). */
  label: string | null;
  /** Bytes done and in total, in network terms when they can be. */
  done: number | null;
  total: number | null;
  /** Bytes per second, when it's real network transfer. */
  rate: number | null;
  /** Seconds left at the current rate. */
  etaSecs: number | null;
  /** `done`/`total` count data unpacked rather than downloaded. */
  unpacked: boolean;
};

/**
 * The same measurements as `progressSummary`, as separate figures for a
 * progress display. App downloads are scaled to network bytes when
 * SteamCMD's content log gave the real sizes (see `progressSummary`).
 */
export const progressFigures = (task: SteamCmdTask): ProgressFigures => {
  const { percent, label, current, total, rate } = task.progress;
  const plan = task.plan;
  const figures: ProgressFigures = {
    percent,
    label: label ? capitalize(label) : null,
    done: current,
    total,
    rate: null,
    etaSecs: null,
    unpacked: false,
  };
  if (label === "downloading" && current !== null) {
    if (plan && plan.downloadTotal > 0 && plan.stageTotal > 0) {
      const ratio = plan.downloadTotal / plan.stageTotal;
      figures.done = Math.min(current * ratio, plan.downloadTotal);
      figures.total = plan.downloadTotal;
      figures.rate = rate ? rate * ratio : null;
    } else {
      figures.unpacked = true;
    }
  } else if (label !== null && NETWORK_LABELS.has(label)) {
    figures.rate = rate;
  }
  if (
    figures.rate &&
    figures.rate > 0 &&
    figures.done !== null &&
    figures.total
  ) {
    figures.etaSecs = Math.max(
      0,
      (figures.total - figures.done) / figures.rate,
    );
  }
  return figures;
};

/** e.g. "4 min left", "about 30 s left". */
export const formatEta = (secs: number) => {
  if (secs < 60) return `${Math.max(1, Math.round(secs / 5) * 5)} s left`;
  if (secs < 3600) return `${Math.round(secs / 60)} min left`;
  const hours = Math.floor(secs / 3600);
  return `${hours} h ${Math.round((secs % 3600) / 60)} min left`;
};

/** Heading for a task card, by kind and outcome. */
export const TASK_TITLES: Record<TaskKind, Record<TaskPhase, string>> = {
  install: {
    running: "Downloading SteamCMD…",
    succeeded: "SteamCMD downloaded",
    failed: "Download failed",
    cancelled: "Download cancelled",
  },
  update: {
    running: "Updating SteamCMD…",
    succeeded: "SteamCMD is up to date",
    failed: "Update failed",
    cancelled: "Update cancelled",
  },
  serverInstall: {
    running: "Installing the server…",
    succeeded: "Server installed",
    failed: "Install failed",
    cancelled: "Install cancelled",
  },
  serverUpdate: {
    running: "Updating the server…",
    succeeded: "Server updated",
    failed: "Update failed",
    cancelled: "Update cancelled",
  },
  serverVerify: {
    running: "Verifying server files…",
    succeeded: "Server files verified",
    failed: "Verification failed",
    cancelled: "Verification cancelled",
  },
  serverCheck: {
    running: "Checking for updates…",
    succeeded: "Update check finished",
    failed: "Update check failed",
    cancelled: "Update check cancelled",
  },
};
