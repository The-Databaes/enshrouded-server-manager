import { Link } from "@tanstack/react-router";
import {
  CircleAlertIcon,
  HourglassIcon,
  TerminalIcon,
  TriangleAlertIcon,
  ZapOffIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { useRuntimeStatus, useServerActions } from "@/hooks/use-server-runtime";
import { formatDuration, formatExitCode } from "@/lib/server/runtime-display";
import type { ServerStatus } from "@/lib/server/types";

/** A first start builds the world, so give it a while before worrying. */
const SLOW_START_MS = 3 * 60_000;

const ConsoleLink = () => (
  <Button size="sm" variant="outline" className="mt-2" asChild>
    <Link to="/console">
      <TerminalIcon data-icon="inline-start" />
      Open console
    </Link>
  </Button>
);

/** Problems worth knowing about before reading the numbers. */
export const DashboardAlerts = ({ files }: { files: ServerStatus }) => {
  const status = useRuntimeStatus();
  const actions = useServerActions();
  const now = useNow(10_000, status?.phase === "starting");
  if (!status) return null;
  const alerts: React.ReactNode[] = [];

  if (status.externalPid !== null) {
    const pid = status.externalPid;
    alerts.push(
      <Alert key="external" variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>
          The server is already running outside the manager
        </AlertTitle>
        <AlertDescription>
          <p>
            A copy of the server from this folder is running (process {pid}), so
            this one can't start. Close it from its own window to let it save,
            or force it to close here.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="mt-2">
                <ZapOffIcon data-icon="inline-start" />
                Force it to close
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Force the other server to close?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  It closes straight away, without saving: anything since its
                  last autosave is lost. Anyone connected is disconnected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void actions.killExternal(pid)}
                >
                  Force close
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </AlertDescription>
      </Alert>,
    );
  }

  const exit = status.lastExit;
  if (status.phase === "stopped" && exit && exit.reason === "unexpected") {
    alerts.push(
      <Alert key="crashed" variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>The server stopped unexpectedly</AlertTitle>
        <AlertDescription>
          <p>
            It exited
            {exit.code === null
              ? ""
              : ` with code ${formatExitCode(exit.code)}`}{" "}
            after running for {formatDuration(exit.ranForMs)}, at{" "}
            {new Date(exit.at).toLocaleTimeString()}. Its last output is in the
            console.
          </p>
          <ConsoleLink />
        </AlertDescription>
      </Alert>,
    );
  }

  if (status.phase === "running" && !status.responding) {
    alerts.push(
      <Alert key="unresponsive" variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>The server isn't answering</AlertTitle>
        <AlertDescription>
          <p>
            It's still running but has stopped responding to status queries on{" "}
            {status.queryAddress}. It may just be busy; if it doesn't recover,
            restart it.
          </p>
          <ConsoleLink />
        </AlertDescription>
      </Alert>,
    );
  }

  if (
    status.phase === "starting" &&
    status.startedAt &&
    now - status.startedAt > SLOW_START_MS
  ) {
    alerts.push(
      <Alert key="slow" variant="info">
        <HourglassIcon />
        <AlertTitle>Still starting…</AlertTitle>
        <AlertDescription>
          <p>
            The server hasn't answered on {status.queryAddress} yet. The first
            start creates the world, which can take a few minutes. If the
            console has stopped moving, something may be wrong.
          </p>
          <ConsoleLink />
        </AlertDescription>
      </Alert>,
    );
  }

  if (files.settings?.file === "invalid") {
    alerts.push(
      <Alert key="settings" variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>The server's settings file couldn't be read</AlertTitle>
        <AlertDescription>
          {files.settings.problem} Until it's fixed, the server may not start,
          and the details shown here are the defaults.
        </AlertDescription>
      </Alert>,
    );
  }

  return alerts.length ? <div className="grid gap-3">{alerts}</div> : null;
};
