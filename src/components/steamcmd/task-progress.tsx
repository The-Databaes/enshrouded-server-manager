import { cn } from "cn";
import { CheckIcon, ChevronDownIcon, CircleIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { SteamCmdConsole } from "@/components/steamcmd/steamcmd-console";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  currentActivity,
  progressSummary,
  type SteamCmdTask,
} from "@/lib/steamcmd/task";
import type { InstallStage } from "@/lib/steamcmd/types";

const INSTALL_STEPS: { stage: InstallStage; label: string }[] = [
  { stage: "downloading", label: "Download" },
  { stage: "extracting", label: "Unpack" },
  { stage: "updating", label: "First-run update" },
];

const describe = (task: SteamCmdTask) => {
  if (task.phase === "succeeded") return "Done";
  if (task.phase === "cancelled") return "Cancelled";
  if (task.phase === "failed") return "Stopped with an error";
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

const StepIcon = ({ state }: { state: StepState }) => {
  if (state === "done") return <CheckIcon className="size-3.5 text-success" />;
  if (state === "failed")
    return <XIcon className="size-3.5 text-destructive" />;
  if (state === "active") return <Spinner className="size-3.5 text-ember" />;
  return <CircleIcon className="size-3 text-muted-foreground/50" />;
};

type TaskProgressProps = {
  task: SteamCmdTask;
  /** Show the live console without the user having to open it. */
  consoleOpenByDefault?: boolean;
};

/** Step list, progress bar and live SteamCMD console for a running job. */
export const TaskProgress = ({
  task,
  consoleOpenByDefault = false,
}: TaskProgressProps) => {
  const [consoleOpen, setConsoleOpen] = useState(consoleOpenByDefault);
  const running = task.phase === "running";
  const showConsole = consoleOpen || task.phase === "failed";
  const { percent } = task.progress;
  const steps = task.kind === "install" ? INSTALL_STEPS : [];
  const activeIndex = steps.findIndex((s) => s.stage === task.stage);

  const stepState = (index: number): StepState => {
    if (task.phase === "succeeded" || index < activeIndex) return "done";
    if (index > activeIndex) return "pending";
    if (task.phase === "failed") return "failed";
    return running ? "active" : "pending";
  };

  return (
    <div className="space-y-3">
      {steps.length ? (
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {steps.map((step, i) => {
            const state = stepState(i);
            return (
              <li
                key={step.stage}
                data-state={state}
                className={cn(
                  "flex items-center gap-1.5",
                  state === "pending" && "text-muted-foreground",
                  state === "active" && "font-medium text-foreground",
                )}
              >
                <StepIcon state={state} />
                {step.label}
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="space-y-1.5">
        <Progress
          value={percent ?? (running ? 100 : 0)}
          tone={
            task.phase === "failed"
              ? "destructive"
              : task.phase === "succeeded"
                ? "success"
                : "ember"
          }
          className={cn(
            running && percent === null && "animate-pulse opacity-60",
          )}
          aria-label="SteamCMD progress"
        />
        <p className="truncate text-xs text-muted-foreground tabular-nums">
          {describe(task)}
        </p>
      </div>

      <Collapsible open={showConsole} onOpenChange={setConsoleOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-xs text-muted-foreground"
          >
            <ChevronDownIcon
              data-icon="inline-start"
              className={cn(
                "transition-transform",
                showConsole && "rotate-180",
              )}
            />
            {showConsole ? "Hide" : "Show"} live console
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SteamCmdConsole
            lines={task.log}
            partial={task.partial}
            running={running}
            className="mt-1"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
