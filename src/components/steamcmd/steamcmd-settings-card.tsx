import {
  DownloadIcon,
  FolderSearchIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Ago, RevealButton } from "@/components/dashboard/server-details";
import { Detail, DetailList, Unknown } from "@/components/layout/page";
import { StatusDot } from "@/components/status-dot";
import { ExistingInstallForm } from "@/components/steamcmd/existing-install-form";
import { TaskProgress } from "@/components/steamcmd/task-progress";
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
import { toAppError } from "@/lib/steamcmd/api";
import { isServerTask } from "@/lib/steamcmd/task";

/** SteamCMD's status and upkeep, for the App settings page. */
export const SteamCmdSettings = () => {
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
    <div className="space-y-8">
      <DetailList className="border-y border-border/55">
        <Detail label="Status">
          <span className="flex items-center gap-2">
            <StatusDot tone="success" />
            Ready
          </span>
        </Detail>
        <Detail label="Location">
          <span
            className="min-w-0 truncate font-mono text-xs"
            title={executable}
          >
            {executable}
          </span>
          <RevealButton path={executable} label="Show in Explorer" />
        </Detail>
        <Detail label="Source">
          {status.managed ? (
            <span>
              Downloaded by the app <Unknown>· kept updated for you</Unknown>
            </span>
          ) : (
            <span>
              Your own installation{" "}
              <Unknown>· never changed by the app</Unknown>
            </span>
          )}
        </Detail>
        <Detail label="Last updated">
          {status.lastUpdatedAt ? (
            <Ago secs={status.lastUpdatedAt} />
          ) : (
            <Unknown>Not yet by the app</Unknown>
          )}
        </Detail>
      </DetailList>

      {ownTask ? (
        <TaskProgress
          task={ownTask}
          onCancel={() => void cancel()}
          onDismiss={dismissTask}
          className="animate-rise-in"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => void runUpdate()}
          disabled={running}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Check for updates
        </Button>

        <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" disabled={running}>
              <FolderSearchIcon data-icon="inline-start" />
              Use a different SteamCMD…
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
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
              variant="destructive-ghost"
              className="ml-auto"
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
      </div>
    </div>
  );
};
