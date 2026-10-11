import { formatDistanceToNow } from "date-fns";
import {
  DownloadIcon,
  FolderOpenIcon,
  RefreshCwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ExistingInstallForm } from "@/components/steamcmd/existing-install-form";
import { TaskProgress } from "@/components/steamcmd/task-progress";
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
import { Badge, BadgeDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { steamcmdApi, toAppError } from "@/lib/steamcmd/api";
import { isServerTask, TASK_TITLES } from "@/lib/steamcmd/task";

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-sm">{children}</dd>
  </div>
);

/** SteamCMD section of the Settings page. */
export const SteamCmdSettingsCard = () => {
  const { status, task, install, update, cancel, dismissTask, forget } =
    useSteamCmd();
  const [changeOpen, setChangeOpen] = useState(false);
  if (!status?.executable) return null;

  // Any SteamCMD job (including server downloads) blocks these actions, but
  // only SteamCMD's own jobs are shown here.
  const running = task?.phase === "running";
  const ownTask = task && !isServerTask(task.kind) ? task : null;
  const executable = status.executable;

  const runUpdate = async () => {
    if (await update()) toast.success("SteamCMD is up to date");
  };

  const reinstall = async () => {
    setChangeOpen(false);
    if (await install()) toast.success("SteamCMD downloaded");
  };

  const remove = async () => {
    try {
      await forget(status.managed);
      toast.success(
        status.managed ? "SteamCMD removed" : "SteamCMD location forgotten",
      );
    } catch (error) {
      toast.error("Couldn't remove SteamCMD", {
        description: toAppError(error).message,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SteamCMD</CardTitle>
        <CardDescription>
          Downloads and updates the Enshrouded dedicated server files.
        </CardDescription>
        <CardAction>
          <Badge variant="success">
            <BadgeDot />
            Ready
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <dl className="space-y-3">
          <Row label="Location">
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate font-mono text-xs">
                {executable}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label="Show in Explorer"
                onClick={() => void steamcmdApi().reveal(executable)}
              >
                <FolderOpenIcon className="size-3.5" />
              </Button>
            </div>
          </Row>
          <Row label="Source">
            {status.managed ? (
              <span>
                Downloaded and managed by the app
                <span className="text-muted-foreground">
                  {" "}
                  · updated and removed for you
                </span>
              </span>
            ) : (
              <span>
                Your own installation
                <span className="text-muted-foreground">
                  {" "}
                  · never modified or deleted by the app
                </span>
              </span>
            )}
          </Row>
          <Row label="Last updated">
            {status.lastUpdatedAt ? (
              <time
                dateTime={new Date(status.lastUpdatedAt * 1000).toISOString()}
                title={new Date(status.lastUpdatedAt * 1000).toLocaleString()}
              >
                {formatDistanceToNow(status.lastUpdatedAt * 1000, {
                  addSuffix: true,
                })}
              </time>
            ) : (
              <span className="text-muted-foreground">
                Not yet updated by the app
              </span>
            )}
          </Row>
        </dl>

        {ownTask ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {TASK_TITLES[ownTask.kind][ownTask.phase]}
              </p>
              {running ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void cancel()}
                >
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
            </div>
            <TaskProgress task={ownTask} />
            {ownTask.phase === "failed" && ownTask.error ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>That didn't work</AlertTitle>
                <AlertDescription>{ownTask.error.message}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex-wrap gap-2 border-t">
        <Button onClick={() => void runUpdate()} disabled={running}>
          <RefreshCwIcon data-icon="inline-start" />
          Check for updates
        </Button>

        <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={running}>
              Change…
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Change SteamCMD</DialogTitle>
              <DialogDescription>
                Point the manager at a different SteamCMD installation.
              </DialogDescription>
            </DialogHeader>
            <ExistingInstallForm
              submitLabel="Switch to this SteamCMD"
              onSaved={() => {
                setChangeOpen(false);
                toast.success("SteamCMD location updated");
              }}
            />
            {status.canDownload ? (
              <>
                <Separator />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {status.managed
                      ? "Something broken? Download a fresh copy from Valve."
                      : "Or let the app download and manage its own copy."}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void reinstall()}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    {status.managed ? "Re-download" : "Download a copy"}
                  </Button>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="text-destructive sm:ml-auto"
              disabled={running}
            >
              <Trash2Icon data-icon="inline-start" />
              {status.managed ? "Remove" : "Forget"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {status.managed ? "Remove SteamCMD?" : "Forget this SteamCMD?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="wrap-anywhere">
                {status.managed
                  ? `This deletes the app's copy of SteamCMD from ${status.managedDir}.`
                  : `The manager will stop using ${executable}. Your files are left untouched.`}{" "}
                You'll be taken back to setup, since the manager can't do
                anything without SteamCMD.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void remove()}
              >
                {status.managed ? "Delete SteamCMD" : "Forget it"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};
