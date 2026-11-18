import { cn } from "cn";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
  ServerIcon,
  ShieldAlertIcon,
  WifiOffIcon,
  XCircleIcon,
} from "lucide-react";
import { useId } from "react";

import { LogoMark } from "@/components/brand/logo";
import { StatusDot } from "@/components/status-dot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { ReleaseNotes } from "@/components/updater/release-notes";
import { useServerActions, useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { useUpdateActions, useUpdater } from "@/hooks/use-updater";
import {
  downloadEtaMs,
  downloadPercent,
  type InstallProgress,
} from "@/lib/app/update-store";
import { formatBytes, TASK_TITLES } from "@/lib/steamcmd/task";
import type { AppError } from "@/lib/steamcmd/types";

/* ---- header ------------------------------------------------------------- */

/** The app's mark, lit; a ring breathes around it while it updates. */
const UpdateMark = ({ busy }: { busy: boolean }) => (
  <div className="relative shrink-0">
    <div
      aria-hidden="true"
      className="absolute -inset-3 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--ember)_30%,transparent),transparent)]"
    />
    {busy ? (
      <div
        aria-hidden="true"
        className="absolute -inset-1 rounded-[26%] border border-ember/50 motion-safe:animate-pulse"
      />
    ) : null}
    <LogoMark
      variant="micro"
      alt=""
      className="relative size-12 rounded-[22%]"
    />
  </div>
);

const VersionJump = ({ from, to }: { from: string | null; to: string }) => (
  <span className="inline-flex items-center gap-1.5 font-mono text-xs">
    {from ? (
      <>
        <span>{from}</span>
        <ArrowRightIcon aria-label="to" className="size-3" />
      </>
    ) : null}
    <span className="text-foreground">{to}</span>
  </span>
);

/* ---- before installing ---------------------------------------------------- */

/** What updating means for a running server, and whether to bring it back. */
const ServerNotice = () => {
  const id = useId();
  const phase = useServerRuntime((s) => s.status?.phase);
  const name = useServerRuntime((s) => s.settings?.name ?? "The server");
  const players = useServerRuntime((s) => s.status?.query?.players ?? 0);
  const resume = useUpdater((s) => s.resumeServer);
  const { setResumeServer } = useUpdateActions();
  if (!phase || phase === "stopped") return null;

  return (
    <div className="rounded-lg border border-border/70 bg-foreground/[0.025] p-4">
      <div className="flex gap-3">
        <ServerIcon className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
            {name} is running
            {players > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <StatusDot tone="success" className="size-1.5" />
                {players === 1
                  ? "1 player online"
                  : `${players} players online`}
              </span>
            ) : null}
          </p>
          <p className="text-[0.8125rem] text-pretty text-muted-foreground">
            It keeps running while the update downloads. Then it stops and saves
            the world, and the manager restarts on the new version
            {players > 0 ? ", which disconnects everyone." : "."}
          </p>
        </div>
      </div>
      <label
        htmlFor={id}
        className="mt-3.5 flex cursor-pointer items-center gap-2.5 border-t border-border/60 pt-3.5 pl-7 text-sm"
      >
        <Checkbox
          id={id}
          checked={resume}
          onCheckedChange={(v) => setResumeServer(v === true)}
        />
        Start the server again once the manager is back
      </label>
    </div>
  );
};

const NotesBody = ({
  notes,
  version,
}: {
  notes: string | null;
  version: string;
}) => {
  const headingId = useId();
  const { openReleasePage } = useUpdateActions();
  return (
    <section aria-labelledby={headingId} className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-sm font-semibold">
          What's new
        </h3>
        <button
          type="button"
          onClick={() => openReleasePage(version)}
          className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          On GitHub
          <ExternalLinkIcon className="size-3" />
        </button>
      </div>
      {notes ? (
        <div
          // A long changelog scrolls here rather than pushing the buttons
          // off-screen; the fade says there's more.
          className="max-h-[min(36vh,16rem)] overflow-y-auto pr-2 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)] pb-4"
        >
          <ReleaseNotes markdown={notes} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This release didn't come with notes.
        </p>
      )}
    </section>
  );
};

/* ---- while installing ------------------------------------------------------ */

type StepState = "pending" | "active" | "done";

const STEP_ORDER = ["download", "stop", "install"] as const;
type StepKey = (typeof STEP_ORDER)[number];

/** Which step `progress` is on. */
const currentStep = (p: InstallProgress): StepKey =>
  p.step === "stoppingServer"
    ? "stop"
    : p.step === "installing"
      ? "install"
      : "download";

const stepState = (step: StepKey, current: StepKey): StepState => {
  const [a, b] = [STEP_ORDER.indexOf(step), STEP_ORDER.indexOf(current)];
  return a < b ? "done" : a === b ? "active" : "pending";
};

const formatEta = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  if (s < 5) return "a few seconds left";
  if (s < 60) return `about ${s} s left`;
  return `about ${Math.ceil(s / 60)} min left`;
};

const downloadDetail = (p: InstallProgress) => {
  if (p.step === "starting") return "Connecting…";
  if (p.step !== "downloading") return "Downloaded and verified";
  const parts = [
    p.total
      ? `${formatBytes(p.downloaded)} of ${formatBytes(p.total)}`
      : formatBytes(p.downloaded),
  ];
  if (p.rate) parts.push(`${formatBytes(p.rate)}/s`);
  const eta = downloadEtaMs(p);
  if (eta !== null) parts.push(formatEta(eta));
  return parts.join(" · ");
};

const StepMarker = ({ state }: { state: StepState }) => (
  <span
    className={cn(
      "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
      state === "done" && "border-success/50 bg-success/15 text-success",
      state === "active" && "border-ember/60 bg-ember/10 text-ember",
      state === "pending" && "border-border bg-popover text-muted-foreground",
    )}
  >
    {state === "done" ? (
      <CheckIcon className="size-3.5" strokeWidth={2.5} />
    ) : state === "active" ? (
      <Spinner className="size-3.5" />
    ) : (
      <span className="size-1.5 rounded-full bg-current opacity-60" />
    )}
  </span>
);

const Step = ({
  state,
  title,
  detail,
  last,
  children,
}: {
  state: StepState;
  title: string;
  detail: string;
  last?: boolean;
  children?: React.ReactNode;
}) => (
  <li
    aria-current={state === "active" ? "step" : undefined}
    className="relative flex gap-3.5 pb-5 last:pb-0"
  >
    {last ? null : (
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 transition-colors duration-500",
          state === "done" ? "bg-success/40" : "bg-border",
        )}
      />
    )}
    <StepMarker state={state} />
    <div className="min-w-0 flex-1 space-y-2 pt-0.5">
      <div>
        <p
          className={cn(
            "text-sm font-medium",
            state === "pending" && "text-muted-foreground",
          )}
        >
          {title}
        </p>
        <p className="text-[0.8125rem] text-muted-foreground tabular-nums">
          {detail}
        </p>
      </div>
      {children}
    </div>
  </li>
);

const InstallSteps = ({ progress }: { progress: InstallProgress }) => {
  const serverActive = useServerRuntime(
    (s) => s.status !== null && s.status.phase !== "stopped",
  );
  const name = useServerRuntime((s) => s.settings?.name ?? "the server");
  const stopsServer = progress.stoppedServer || serverActive;
  const current = currentStep(progress);
  const percent = downloadPercent(progress);
  const downloading = current === "download";

  const announce = {
    download: "Downloading the update",
    stop: `Stopping ${name}`,
    install: "Installing the update. The manager will restart.",
  }[current];

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ol aria-label="Update progress" className="py-1">
        <Step
          state={stepState("download", current)}
          title="Download the update"
          detail={downloadDetail(progress)}
        >
          {downloading ? (
            <Progress
              value={percent ?? 100}
              aria-label="Download progress"
              className={cn(
                "h-1.5",
                percent === null && "opacity-60 motion-safe:animate-pulse",
              )}
            />
          ) : null}
        </Step>
        {stopsServer ? (
          <Step
            state={stepState("stop", current)}
            title={`Stop ${name}`}
            detail={
              current === "install"
                ? "Stopped, with the world saved"
                : "It saves the world first, which can take a moment"
            }
          />
        ) : null}
        <Step
          last
          state={stepState("install", current)}
          title="Install and restart"
          detail="The installer takes over, then the manager opens again by itself"
        />
      </ol>
    </>
  );
};

/* ---- after a failure ------------------------------------------------------- */

const FAILURES: Record<string, { title: string; icon: typeof XCircleIcon }> = {
  updateVerification: {
    title: "The update didn't pass verification",
    icon: ShieldAlertIcon,
  },
  updateOffline: {
    title: "The download didn't get through",
    icon: WifiOffIcon,
  },
};

const InstallFailure = ({ error }: { error: AppError }) => {
  const { title, icon: Icon } = FAILURES[error.kind] ?? {
    title: "Couldn't install the update",
    icon: XCircleIcon,
  };
  return (
    <Alert variant="destructive" role="alert">
      <Icon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-pretty">
        {error.message}
      </AlertDescription>
    </Alert>
  );
};

/* ---- the dialog ----------------------------------------------------------- */

/** "Version 0.2.0 is out": what's new, what updating does, and the update. */
export const UpdateDialog = () => {
  const open = useUpdater((s) => s.dialogOpen);
  const update = useUpdater((s) => s.update);
  const progress = useUpdater((s) => s.install);
  const error = useUpdater((s) => s.installError);
  const failedAfterStop = useUpdater((s) => s.failedAfterStoppingServer);
  const current = useUpdater((s) => s.currentVersion);
  const actions = useUpdateActions();
  const serverActions = useServerActions();
  const phase = useServerRuntime((s) => s.status?.phase);
  const { task } = useSteamCmd();
  const steamcmdBusy = task?.phase === "running";

  if (!update) return null;
  const committed =
    progress?.step === "stoppingServer" || progress?.step === "installing";
  const keepOpen = (e: Event) => {
    if (committed) e.preventDefault();
  };

  const eyebrow = progress
    ? committed
      ? "Installing"
      : "Updating"
    : error
      ? "Update failed"
      : "Update available";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? actions.openDialog() : actions.closeDialog())}
    >
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={keepOpen}
        onInteractOutside={keepOpen}
        className="gap-0 overflow-hidden p-0 sm:max-w-[34rem]"
      >
        <header className="relative overflow-hidden border-b border-border/60 px-6 pt-6 pb-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 -left-20 size-72 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--ember)_14%,transparent),transparent)]"
          />
          <div className="relative flex items-center gap-4">
            <UpdateMark busy={progress !== null} />
            <div className="min-w-0 space-y-1">
              <p
                className={cn(
                  "eyebrow",
                  error && !progress ? "text-destructive" : "text-ember",
                )}
              >
                {eyebrow}
              </p>
              <DialogTitle className="text-[1.375rem] leading-tight font-semibold">
                Version {update.version}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <VersionJump
                  from={current ?? update.currentVersion}
                  to={update.version}
                />
                {update.date ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Released{" "}
                      {formatDistanceToNow(update.date, { addSuffix: true })}
                    </span>
                  </>
                ) : null}
              </DialogDescription>
            </div>
          </div>
        </header>

        <div className="space-y-4 px-6 py-5">
          {progress ? (
            <InstallSteps progress={progress} />
          ) : (
            <>
              {error ? <InstallFailure error={error} /> : null}
              <NotesBody notes={update.notes} version={update.version} />
              <ServerNotice />
              {task?.phase === "running" ? (
                <Alert variant="info">
                  <Spinner />
                  <AlertTitle>{TASK_TITLES[task.kind].running}</AlertTitle>
                  <AlertDescription>
                    The update can start once this SteamCMD task has finished.
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-foreground/[0.02] px-6 py-4">
          {progress ? (
            committed ? (
              <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                <Spinner className="size-3.5" />
                Keep the manager open: it closes and reopens by itself.
              </p>
            ) : (
              <>
                <p className="text-[0.8125rem] text-muted-foreground">
                  You can keep working. Progress stays in the sidebar.
                </p>
                <Button
                  variant="outline"
                  className="ml-auto"
                  onClick={actions.closeDialog}
                >
                  Hide
                </Button>
              </>
            )
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 text-muted-foreground"
                onClick={() => actions.skip(update.version)}
              >
                Skip this version
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                {failedAfterStop && phase === "stopped" ? (
                  <Button
                    variant="outline"
                    onClick={() => void serverActions.start()}
                  >
                    Start the server
                  </Button>
                ) : (
                  <Button variant="outline" onClick={actions.closeDialog}>
                    Later
                  </Button>
                )}
                <Button
                  disabled={steamcmdBusy}
                  onClick={() => void actions.install()}
                >
                  {error ? (
                    <RotateCcwIcon data-icon="inline-start" />
                  ) : (
                    <DownloadIcon data-icon="inline-start" />
                  )}
                  {error ? "Try again" : "Update and restart"}
                </Button>
              </div>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
};
