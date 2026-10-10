import { formatDistanceToNow } from "date-fns";
import {
  DownloadIcon,
  FolderOpenIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UnlinkIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ServerFolderForm } from "@/components/server/server-folder-form";
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
import { Badge } from "@/components/ui/badge";
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
import type { useServer } from "@/hooks/use-server";
import type { ServerStatus } from "@/lib/server/types";
import { steamcmdApi, toAppError } from "@/lib/steamcmd/api";
import { formatBytes } from "@/lib/steamcmd/task";

const ago = (secs: number | null, never: string) =>
  secs ? (
    <time
      dateTime={new Date(secs * 1000).toISOString()}
      title={new Date(secs * 1000).toLocaleString()}
    >
      {formatDistanceToNow(secs * 1000, { addSuffix: true })}
    </time>
  ) : (
    <span className="text-muted-foreground">{never}</span>
  );

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

const StatusBadge = ({ status }: { status: ServerStatus }) => {
  if (status.state === "incomplete")
    return (
      <Badge variant="outline" className="border-ember/40 text-ember">
        Incomplete
      </Badge>
    );
  if (status.updateAvailable)
    return (
      <Badge
        variant="outline"
        className="border-warning/40 bg-warning/10 text-warning"
      >
        <span className="size-1.5 rounded-full bg-warning" />
        Update available
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="border-success/40 bg-success/10 text-success"
    >
      <span className="size-1.5 rounded-full bg-success" />
      {status.updateAvailable === false ? "Up to date" : "Installed"}
    </Badge>
  );
};

type ServerOverviewCardProps = {
  status: ServerStatus;
  server: ReturnType<typeof useServer>;
  /** A SteamCMD job (of any kind) is running. */
  busy: boolean;
};

/** What's installed where, and the SteamCMD actions for it. */
export const ServerOverviewCard = ({
  status,
  server,
  busy,
}: ServerOverviewCardProps) => {
  const [changeOpen, setChangeOpen] = useState(false);
  const dir = status.installDir ?? "";
  const installed = status.state === "installed";

  const forget = async () => {
    try {
      await server.forget();
      toast.success("Server folder forgotten", {
        description: "The files were left where they are.",
      });
    } catch (error) {
      toast.error("Couldn't forget the server", {
        description: toAppError(error).message,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enshrouded Dedicated Server</CardTitle>
        <CardDescription>
          Steam app {status.appId} · downloaded anonymously with SteamCMD
        </CardDescription>
        <CardAction>
          <StatusBadge status={status} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {status.state === "incomplete" ? (
          <Alert className="border-ember/40">
            <TriangleAlertIcon className="text-ember" />
            <AlertTitle>The install didn't finish</AlertTitle>
            <AlertDescription>
              <p>
                The server files in this folder are missing or incomplete.
                Resuming only downloads what's left.
              </p>
              <Button
                size="sm"
                className="mt-2"
                disabled={busy}
                onClick={() => void server.install(dir)}
              >
                <DownloadIcon data-icon="inline-start" />
                Resume install
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <dl className="space-y-3">
          <Row label="Folder">
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate font-mono text-xs">{dir}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label="Show in Explorer"
                onClick={() =>
                  void steamcmdApi().reveal(
                    installed ? `${dir}\\enshrouded_server.exe` : dir,
                  )
                }
              >
                <FolderOpenIcon className="size-3.5" />
              </Button>
            </div>
          </Row>
          <Row label="Installed build">
            {status.buildId ? (
              <span className="font-mono text-xs">{status.buildId}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            {status.updateAvailable && status.latestBuildId ? (
              <span className="text-warning">
                {" "}
                →{" "}
                <span className="font-mono text-xs">
                  {status.latestBuildId}
                </span>{" "}
                available
              </span>
            ) : null}
          </Row>
          <Row label="Size on disk">
            {status.sizeOnDisk ? (
              formatBytes(status.sizeOnDisk)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Row>
          <Row label="Files updated">
            {ago(status.lastUpdatedAt, "Not installed yet")}
          </Row>
          <Row label="Last verified">{ago(status.lastVerifiedAt, "Never")}</Row>
          <Row label="Last checked">{ago(status.lastCheckedAt, "Never")}</Row>
        </dl>
      </CardContent>

      <CardFooter className="flex-wrap gap-2 border-t">
        <Button
          variant={status.updateAvailable ? "default" : "outline"}
          className={status.updateAvailable ? "shadow-glow-flame" : undefined}
          disabled={busy || !installed}
          onClick={() => void server.update()}
        >
          <DownloadIcon data-icon="inline-start" />
          Update server
        </Button>
        <Button
          variant="outline"
          disabled={busy || !installed}
          onClick={() => void server.checkUpdate()}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Check for updates
        </Button>
        <Button
          variant="outline"
          disabled={busy || !installed}
          onClick={() => void server.verify()}
        >
          <ShieldCheckIcon data-icon="inline-start" />
          Verify files
        </Button>

        <div className="flex gap-2 sm:ml-auto">
          <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" disabled={busy}>
                Change folder…
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Change server folder</DialogTitle>
                <DialogDescription>
                  Install the server somewhere else, or point at a folder that
                  already has it. The current files are left where they are.
                </DialogDescription>
              </DialogHeader>
              <ServerFolderForm
                initialPath={dir}
                onSubmit={(path) => {
                  setChangeOpen(false);
                  void server.install(path);
                }}
              />
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={busy}
              >
                <UnlinkIcon data-icon="inline-start" />
                Forget
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Forget this server?</AlertDialogTitle>
                <AlertDialogDescription className="wrap-anywhere">
                  The manager will stop using {dir}. Nothing is deleted: choose
                  the same folder again to pick it back up.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void forget()}
                >
                  Forget it
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardFooter>
    </Card>
  );
};
