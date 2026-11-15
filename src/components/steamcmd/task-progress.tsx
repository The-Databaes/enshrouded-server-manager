import { cn } from "cn";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleSlashIcon,
  TerminalIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { SteamCmdConsole } from "@/components/steamcmd/steamcmd-console";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import {
  currentActivity,
  formatBytes,
  formatEta,
  progressFigures,
  progressSummary,
  type SteamCmdTask,
  TASK_TITLES,
} from "@/lib/steamcmd/task";
import type { InstallStage } from "@/lib/steamcmd/types";

const INSTALL_STEPS: { stage: InstallStage; label: string }[] = [
  { stage: "downloading", label: "Download" },
  { stage: "extracting", label: "Unpack" },
  { stage: "updating", label: "First-run update" },
];

/** What's happening right now, in a line. */
const describe = (task: SteamCmdTask) => {
  if (task.phase === "succeeded") return "Finished.";
  if (task.phase === "cancelled")
    return task.kind === "serverCheck"
      ? "Stopped."
      : "Stopped part-way. Run it again to continue; SteamCMD picks up where it left off.";
  if (task.phase === "failed") return "Stopped with an error.";
  const progress = progressSummary(task);
  if (task.kind === "install" || task.kind === "update") {
    if (task.stage === "downloading" && !task.progress.current)
      return "Contacting Valve…";
    if (task.stage === "extracting") return "Unpacking…";
    if (task.stage === "updating" && !progress)
      return "SteamCMD is updating itself…";
  }
  // Without byte counts a progress label goes stale quickly; SteamCMD's
  // latest line says what it's really doing (e.g. "Waiting for user info...").
  if (progress && task.progress.total !== null) return progress;
  const activity = currentActivity(task);
  if (activity && !activity.startsWith("> ")) return activity;
  return task.kind === "serverCheck"
    ? "Asking Steam for the latest build…"
    : "Starting SteamCMD and connecting to Steam…";
};

type StepState = "done" | "active" | "failed" | "pending";

const Steps = ({ task }: { task: SteamCmdTask }) => {
  const activeIndex = INSTALL_STEPS.findIndex((s) => s.stage === task.stage);
  const stateOf = (index: number): StepState => {
    if (task.phase === "succeeded" || index < activeIndex) return "done";
    if (index > activeIndex) return "pending";
    if (task.phase === "failed") return "failed";
    return task.phase === "running" ? "active" : "pending";
  };
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {INSTALL_STEPS.map((step, i) => {
        const state = stateOf(i);
        return (
          <li
            key={step.stage}
            data-state={state}
            className="flex items-center gap-2"
          >
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px w-6",
                  state === "pending" ? "bg-border" : "bg-ember/50",
                )}
              />
            ) : null}
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border",
                state === "done" &&
                  "border-success/50 bg-success/15 text-success",
                state === "active" && "border-ember/60 text-ember",
                state === "failed" &&
                  "border-destructive/50 bg-destructive/15 text-destructive",
                state === "pending" && "text-muted-foreground",
              )}
            >
              {state === "done" ? (
                <CheckIcon className="size-3" />
              ) : state === "failed" ? (
                <XIcon className="size-3" />
              ) : state === "active" ? (
                <Spinner className="size-3" />
              ) : (
                <span className="size-1 rounded-full bg-current" />
              )}
            </span>
            <span
              className={cn(
                state === "pending" ? "text-muted-foreground" : "font-medium",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/** A thick progress bar that glows, with a highlight sweeping along it
 * while it runs. Indeterminate when `value` is null. */
export const GlowBar = ({
  value,
  tone,
  running,
  className,
  label,
}: {
  value: number | null;
  tone: "ember" | "success" | "destructive" | "muted";
  running: boolean;
  className?: string;
  label: string;
}) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value === null ? undefined : Math.round(value)}
    className={cn(
      "relative h-2 overflow-hidden rounded-full bg-foreground/[0.07]",
      className,
    )}
  >
    <div
      className={cn(
        "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
        tone === "ember" &&
          "ember-fill shadow-[0_0_14px_color-mix(in_oklch,var(--ember)_70%,transparent)]",
        tone === "success" && "bg-success",
        tone === "destructive" && "bg-destructive",
        tone === "muted" && "bg-stone",
        value === null &&
          running &&
          "w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite]",
      )}
      style={value === null ? undefined : { width: `${Math.max(2, value)}%` }}
    />
    {running && value !== null ? (
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${value}%` }}
      >
        <div className="h-full w-1/3 animate-shimmer bg-linear-to-r from-transparent via-white/40 to-transparent" />
      </div>
    ) : null}
  </div>
);

const Figure = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="min-w-0 space-y-1">
    <dt className="eyebrow">{label}</dt>
    <dd className="truncate text-sm font-medium tabular-nums">{children}</dd>
  </div>
);

type TaskProgressProps = {
  task: SteamCmdTask;
  /** Show the live console without the user having to open it. */
  consoleOpenByDefault?: boolean;
  onCancel?: () => void;
  onDismiss?: () => void;
  /** Heading override (defaults to the task's title). */
  title?: string;
  className?: string;
};

/**
 * A SteamCMD job: what it is, how far along, how fast, and its console.
 * Drawn on the page, not in a box.
 */
export const TaskProgress = ({
  task,
  consoleOpenByDefault = false,
  onCancel,
  onDismiss,
  title,
  className,
}: TaskProgressProps) => {
  const [consoleOpen, setConsoleOpen] = useState(consoleOpenByDefault);
  const running = task.phase === "running";
  const showConsole = consoleOpen || task.phase === "failed";
  const figures = progressFigures(task);
  const percent = task.phase === "succeeded" ? 100 : figures.percent;
  const tone =
    task.phase === "failed"
      ? "destructive"
      : task.phase === "succeeded"
        ? "success"
        : task.phase === "cancelled"
          ? "muted"
          : "ember";

  return (
    <section
      aria-label={title ?? TASK_TITLES[task.kind][task.phase]}
      aria-live="polite"
      className={cn("space-y-5", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-full border",
              running && "border-ember/50 text-ember",
              task.phase === "succeeded" &&
                "border-success/50 bg-success/12 text-success",
              task.phase === "failed" &&
                "border-destructive/50 bg-destructive/12 text-destructive",
              task.phase === "cancelled" && "text-muted-foreground",
            )}
          >
            {running ? (
              <Spinner className="size-4" />
            ) : task.phase === "succeeded" ? (
              <CheckIcon className="size-4" />
            ) : task.phase === "failed" ? (
              <TriangleAlertIcon className="size-4" />
            ) : (
              <CircleSlashIcon className="size-4" />
            )}
          </span>
          <div>
            <h2 className="font-sans text-base font-semibold tracking-normal">
              {title ?? TASK_TITLES[task.kind][task.phase]}
            </h2>
            <p className="text-xs text-muted-foreground">
              {running
                ? "Runs in the background: you can leave this page."
                : "Output from the last SteamCMD run is below."}
            </p>
          </div>
        </div>
        {running && onCancel ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : !running && onDismiss ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>

      {task.kind === "install" ? <Steps task={task} /> : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
          <p
            className={cn(
              "text-[2.75rem] leading-none font-semibold tracking-tight tabular-nums",
              running ? "text-gilded" : "text-foreground/90",
            )}
          >
            {percent === null ? (
              <span className="text-2xl font-medium text-muted-foreground">
                Working…
              </span>
            ) : (
              <>
                {Math.floor(percent)}
                <span className="ml-0.5 text-2xl text-muted-foreground">%</span>
              </>
            )}
          </p>
          {running && figures.done !== null && figures.total ? (
            <dl className="flex flex-wrap gap-x-8 gap-y-2">
              <Figure label={figures.unpacked ? "Unpacked" : "Downloaded"}>
                {formatBytes(figures.done)}{" "}
                <span className="text-muted-foreground">
                  of {formatBytes(figures.total)}
                </span>
              </Figure>
              {figures.rate ? (
                <Figure label="Speed">{formatBytes(figures.rate)}/s</Figure>
              ) : null}
              {figures.etaSecs !== null ? (
                <Figure label="Time left">{formatEta(figures.etaSecs)}</Figure>
              ) : null}
            </dl>
          ) : null}
        </div>
        <GlowBar
          value={percent}
          tone={tone}
          running={running}
          label="SteamCMD progress"
        />
        <p className="truncate text-xs text-muted-foreground tabular-nums">
          {describe(task)}
        </p>
      </div>

      {task.phase === "failed" && task.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>SteamCMD reported a problem</AlertTitle>
          <AlertDescription className="wrap-anywhere">
            {task.error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <Collapsible open={showConsole} onOpenChange={setConsoleOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2.5 text-muted-foreground"
          >
            <TerminalIcon data-icon="inline-start" />
            {showConsole ? "Hide" : "Show"} SteamCMD output
            <ChevronDownIcon
              data-icon="inline-end"
              className={cn(
                "transition-transform",
                showConsole && "rotate-180",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SteamCmdConsole
            lines={task.log}
            partial={task.partial}
            running={running}
            className="mt-2"
          />
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
};
