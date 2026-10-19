import { createFileRoute } from "@tanstack/react-router";
import { InfoIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";

import { PageHeader } from "@/components/app-shell/app-shell";
import { ServerActivityCard } from "@/components/server/server-activity-card";
import { ServerFolderForm } from "@/components/server/server-folder-form";
import { ServerOverviewCard } from "@/components/server/server-overview-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer } from "@/hooks/use-server";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";

const Servers = () => {
  const server = useServer();
  const { task } = useSteamCmd();
  const { status, loadError } = server;
  const busy = task?.phase === "running";
  const otherJobRunning =
    busy && (task.kind === "install" || task.kind === "update");
  const serverRunning = useServerRuntime((s) =>
    Boolean(s.status && s.status.phase !== "stopped"),
  );

  return (
    <>
      <PageHeader
        title="Servers"
        description="Install, update and verify the Enshrouded dedicated server with SteamCMD."
      />
      <div className="grid max-w-4xl gap-4">
        {serverRunning ? (
          <Alert variant="info">
            <InfoIcon />
            <AlertTitle>The server is running</AlertTitle>
            <AlertDescription>
              Its files can't be updated, verified or moved while it runs. Stop
              it from the Dashboard first.
            </AlertDescription>
          </Alert>
        ) : null}
        {otherJobRunning ? (
          <p className="text-sm text-muted-foreground">
            SteamCMD is busy updating itself; server actions will be available
            when it's done.
          </p>
        ) : null}

        {loadError && !status ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Couldn't read the server status</AlertTitle>
            <AlertDescription>
              <p>{loadError.message}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => void server.refresh()}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : !status ? (
          <Skeleton className="h-64 w-full" />
        ) : status.state === "notInstalled" ? (
          <Card>
            <CardHeader>
              <CardTitle>Install the Enshrouded server</CardTitle>
              <CardDescription className="text-pretty">
                SteamCMD downloads the dedicated server from Steam. No Steam
                account is needed. Already have the server files? Choose that
                folder and they'll be verified instead of downloaded again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServerFolderForm
                initialPath={status.defaultInstallDir}
                disabled={busy}
                onSubmit={(path) => void server.install(path)}
              />
            </CardContent>
          </Card>
        ) : (
          <ServerOverviewCard
            status={status}
            server={server}
            busy={busy || serverRunning}
          />
        )}

        <ServerActivityCard />
      </div>
    </>
  );
};

export const Route = createFileRoute("/servers")({
  component: Servers,
});
