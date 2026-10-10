import { TriangleAlertIcon, XIcon } from "lucide-react";

import { TaskProgress } from "@/components/steamcmd/task-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { isServerTask, TASK_TITLES } from "@/lib/steamcmd/task";

/** Progress and live console of the current (or last) server job. */
export const ServerActivityCard = () => {
  const { task, cancel, dismissTask } = useSteamCmd();
  if (!task || !isServerTask(task.kind)) return null;
  const running = task.phase === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TASK_TITLES[task.kind][task.phase]}</CardTitle>
        <CardDescription>
          {running
            ? "You can leave this page; the job keeps running."
            : "Output from the last SteamCMD run."}
        </CardDescription>
        <CardAction>
          {running ? (
            <Button variant="outline" size="sm" onClick={() => void cancel()}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Dismiss"
              onClick={dismissTask}
            >
              <XIcon className="size-3.5" />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.phase === "failed" && task.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>SteamCMD reported a problem</AlertTitle>
            <AlertDescription>{task.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {task.phase === "cancelled" && task.kind !== "serverCheck" ? (
          <p className="text-sm text-muted-foreground">
            Stopped part-way. Run it again to continue; SteamCMD picks up where
            it left off.
          </p>
        ) : null}
        <TaskProgress task={task} consoleOpenByDefault />
      </CardContent>
    </Card>
  );
};
