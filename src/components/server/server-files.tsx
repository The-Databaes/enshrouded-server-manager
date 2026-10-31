import { cn } from "cn";
import {
  CircleHelpIcon,
  DownloadIcon,
  FolderIcon,
  FolderInputIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UnlinkIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Ago, RevealButton } from "@/components/dashboard/server-details";
import {
  Fact,
  Facts,
  Section,
  SettingList,
  SettingRow,
  Unknown,
} from "@/components/layout/page";
import { ServerFolderForm } from "@/components/server/server-folder-form";
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
import type { useServer } from "@/hooks/use-server";
import type { ServerStatus } from "@/lib/server/types";
import { toAppError } from "@/lib/steamcmd/api";
import { formatBytes } from "@/lib/steamcmd/task";

type Server = ReturnType<typeof useServer>;

type Verdict = {
  tone: "success" | "warning" | "ember" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: React.ReactNode;
};

const verdictOf = (status: ServerStatus): Verdict => {
  if (status.state === "incomplete")
    return {
      tone: "warning",
      icon: TriangleAlertIcon,
      title: "The install didn't finish",
      description:
        "Some server files are missing or incomplete. Resuming downloads only what's left.",
    };
  if (status.updateAvailable)
    return {
      tone: "ember",
      icon: DownloadIcon,
      title: "An update is out",
      description: (
        <>
          Build{" "}
          <span className="font-mono text-foreground">
            {status.latestBuildId}
          </span>{" "}
          is on Steam; this server has{" "}
          <span className="font-mono text-foreground">{status.buildId}</span>.
          Players need the same version as the server to join.
        </>
      ),
    };
  if (status.updateAvailable === false)
    return {
      tone: "success",
      icon: ShieldCheckIcon,
      title: "Up to date",
      description: (
        <>
          This is the newest build on Steam
          {status.lastCheckedAt ? (
            <>
              , checked <Ago secs={status.lastCheckedAt} />
            </>
          ) : null}
          .
        </>
      ),
    };
  return {
    tone: "neutral",
    icon: CircleHelpIcon,
    title: "Installed",
    description:
      "It hasn't been compared with Steam yet. Check to see whether a newer build is out.",
  };
};

const TONE_CLASS = {
  success:
    "border-success/35 bg-success/10 text-success shadow-[0_0_32px_-10px_var(--success)]",
  warning:
    "border-warning/40 bg-warning/10 text-warning shadow-[0_0_32px_-10px_var(--warning)]",
  ember:
    "border-ember/45 bg-ember/10 text-ember shadow-[0_0_32px_-8px_var(--ember)]",
  neutral: "border-border bg-foreground/[0.04] text-muted-foreground",
} as const;

/** Where the install stands, and the one thing to do about it. */
export const FilesVerdict = ({
  status,
  server,
  busy,
}: {
  status: ServerStatus;
  server: Server;
  busy: boolean;
}) => {
  const verdict = verdictOf(status);
  const Icon = verdict.icon;
  const dir = status.installDir ?? "";

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <span
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-2xl border",
          TONE_CLASS[verdict.tone],
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-sans text-xl font-semibold tracking-normal">
          {verdict.title}
        </h2>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          {verdict.description}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {status.state === "incomplete" ? (
          <Button disabled={busy} onClick={() => void server.install(dir)}>
            <DownloadIcon data-icon="inline-start" />
            Resume install
          </Button>
        ) : status.updateAvailable ? (
          <Button disabled={busy} onClick={() => void server.update()}>
            <DownloadIcon data-icon="inline-start" />
            Update now
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void server.checkUpdate()}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Check for updates
          </Button>
        )}
      </div>
    </section>
  );
};

/** The install as a spec sheet. */
export const FilesFacts = ({ status }: { status: ServerStatus }) => (
  <Facts>
    <Fact
      label="Installed build"
      hint={
        status.updateAvailable && status.latestBuildId ? (
          <span className="text-ember">{status.latestBuildId} available</span>
        ) : (
          `Steam app ${status.appId}`
        )
      }
    >
      {status.buildId ? (
        <span className="font-mono">{status.buildId}</span>
      ) : (
        <Unknown />
      )}
    </Fact>
    <Fact label="Size on disk">
      {status.sizeOnDisk ? formatBytes(status.sizeOnDisk) : <Unknown />}
    </Fact>
    <Fact label="Files updated">
      {status.lastUpdatedAt ? (
        <Ago secs={status.lastUpdatedAt} />
      ) : (
        <Unknown>Not yet</Unknown>
      )}
    </Fact>
    <Fact label="Last verified">
      {status.lastVerifiedAt ? (
        <Ago secs={status.lastVerifiedAt} />
      ) : (
        <Unknown>Never</Unknown>
      )}
    </Fact>
    <Fact label="Last checked">
      {status.lastCheckedAt ? (
        <Ago secs={status.lastCheckedAt} />
      ) : (
        <Unknown>Never</Unknown>
      )}
    </Fact>
  </Facts>
);

/** Updating, verifying and checking, each with what it does. */
export const FilesMaintenance = ({
  status,
  server,
  busy,
}: {
  status: ServerStatus;
  server: Server;
  busy: boolean;
}) => {
  const installed = status.state === "installed";
  return (
    <Section
      title="Maintenance"
      description="SteamCMD does the work. The server must be stopped, and only one job runs at a time."
      rule
    >
      <SettingList>
        <SettingRow
          label="Update the server"
          description="Downloads the newest build from Steam. Your world, settings and logs aren't touched."
          control="sm"
        >
          <Button
            className="w-full"
            variant="outline"
            disabled={busy || !installed}
            onClick={() => void server.update()}
          >
            <DownloadIcon data-icon="inline-start" />
            Update
          </Button>
        </SettingRow>
        <SettingRow
          label="Verify files"
          description="Checks every file against Steam and repairs anything missing or damaged. Takes a minute or two."
          control="sm"
        >
          <Button
            className="w-full"
            variant="outline"
            disabled={busy || !installed}
            onClick={() => void server.verify()}
          >
            <ShieldCheckIcon data-icon="inline-start" />
            Verify
          </Button>
        </SettingRow>
        <SettingRow
          label="Check for updates"
          description="Asks Steam for the newest build without downloading anything."
          control="sm"
        >
          <Button
            className="w-full"
            variant="outline"
            disabled={busy || !installed}
            onClick={() => void server.checkUpdate()}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Check
          </Button>
        </SettingRow>
      </SettingList>
    </Section>
  );
};

/** Where the files are, with moving and forgetting. */
export const FilesLocation = ({
  status,
  server,
  busy,
}: {
  status: ServerStatus;
  server: Server;
  busy: boolean;
}) => {
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
    <Section
      title="Location"
      description="The server, its settings file, world saves and logs all live in this folder."
      rule
      actions={
        <>
          <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <FolderInputIcon data-icon="inline-start" />
                Change folder…
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Change the server folder</DialogTitle>
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
              <Button variant="destructive-ghost" size="sm" disabled={busy}>
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
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-lg border bg-console px-4 py-3">
        <FolderIcon className="size-4 shrink-0 text-ember" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={dir}>
          {dir}
        </span>
        <RevealButton
          path={installed ? `${dir}\\enshrouded_server.exe` : dir}
          label="Show in Explorer"
        />
      </div>
    </Section>
  );
};
