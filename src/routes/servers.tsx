import { createFileRoute, Link } from "@tanstack/react-router";
import { InfoIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";

import { Page, PageHeader, Section } from "@/components/layout/page";
import {
  FilesFacts,
  FilesLocation,
  FilesMaintenance,
  FilesVerdict,
} from "@/components/server/server-files";
import { ServerFolderForm } from "@/components/server/server-folder-form";
import { TaskProgress } from "@/components/steamcmd/task-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer } from "@/hooks/use-server";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { isServerTask } from "@/lib/steamcmd/task";

const Servers = () => {
  const server = useServer();
  const { task, cancel, dismissTask } = useSteamCmd();
  const { status, loadError } = server;
  const busy = task?.phase === "running";
  const otherJobRunning = busy && !isServerTask(task.kind);
  const serverRunning = useServerRuntime((s) =>
    Boolean(s.status && s.status.phase !== "stopped"),
  );
  const serverTask = task && isServerTask(task.kind) ? task : null;
  const locked = busy || serverRunning;

  return (
    <Page>
      <PageHeader
        eyebrow="Enshrouded dedicated server"
        title="Server files"
        description="Install, update and repair the server. SteamCMD downloads it from Steam without an account."
      />

      {serverRunning ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>The server is running</AlertTitle>
          <AlertDescription>
            Its files can't be updated, verified or moved while it runs.{" "}
            <Link to="/">Stop it from the dashboard</Link> first.
          </AlertDescription>
        </Alert>
      ) : otherJobRunning ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertDescription>
            SteamCMD is busy updating itself. Server jobs are available again
            when it's done.
          </AlertDescription>
        </Alert>
      ) : null}

      {serverTask ? (
        <TaskProgress
          task={serverTask}
          consoleOpenByDefault
          onCancel={() => void cancel()}
          onDismiss={dismissTask}
          className="animate-rise-in"
        />
      ) : null}

      {loadError && !status ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Couldn't read the server's status</AlertTitle>
          <AlertDescription>
            <p>{loadError.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => void server.refresh()}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : !status ? (
        <div className="space-y-8" aria-busy="true">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : status.state === "notInstalled" ? (
        <Section
          title="Install the server"
          description="Choose where it goes. It needs about 10 GB free. Already have the server files? Choose that folder and they're checked instead of downloaded again."
          rule={Boolean(serverTask)}
        >
          <ServerFolderForm
            initialPath={status.defaultInstallDir}
            disabled={busy}
            onSubmit={(path) => void server.install(path)}
          />
        </Section>
      ) : (
        <>
          <FilesVerdict status={status} server={server} busy={locked} />
          <FilesFacts status={status} />
          <FilesMaintenance status={status} server={server} busy={locked} />
          <FilesLocation status={status} server={server} busy={locked} />
        </>
      )}
    </Page>
  );
};

export const Route = createFileRoute("/servers")({
  component: Servers,
});
