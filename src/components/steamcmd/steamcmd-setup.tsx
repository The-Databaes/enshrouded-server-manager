import {
  ArrowRightIcon,
  CircleCheckBigIcon,
  DownloadIcon,
  FolderSearchIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useId, useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { ExistingInstallForm } from "@/components/steamcmd/existing-install-form";
import { TaskProgress } from "@/components/steamcmd/task-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import type { SteamCmdStatus } from "@/lib/steamcmd/types";

type Choice = "download" | "existing";

/** Full-window first-run screen: get SteamCMD before anything else. */
export const SteamCmdSetup = ({
  status,
  onContinue,
}: {
  status: SteamCmdStatus;
  onContinue: () => void;
}) => {
  return (
    <div className="flex min-h-full items-center justify-center bg-shroud-mist p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-6">
        <header className="flex flex-col items-center gap-4 text-center">
          <LogoMark tile className="size-16 rounded-2xl shadow-glow-flame" />
          <div className="space-y-2">
            <Badge variant="outline" className="border-gold/40 text-gold">
              First-time setup
            </Badge>
            <h1 className="font-display text-3xl font-bold tracking-[0.08em] text-flame-gradient">
              {status.availability === "ready"
                ? "The path is clear"
                : "Before the Flame is lit"}
            </h1>
            <div className="mx-auto h-px w-40 bg-linear-to-r from-transparent via-gold to-transparent" />
          </div>
        </header>

        {status.availability === "ready" ? (
          <ReadyCard status={status} onContinue={onContinue} />
        ) : (
          <SetupCard status={status} />
        )}

        <p className="text-center text-xs text-muted-foreground">
          SteamCMD is made by Valve Corporation and is downloaded directly from
          Valve's servers.
        </p>
      </div>
    </div>
  );
};

const SetupCard = ({ status }: { status: SteamCmdStatus }) => {
  const { task, install } = useSteamCmd();
  const [choice, setChoice] = useState<Choice>(
    status.canDownload ? "download" : "existing",
  );
  const downloadId = useId();
  const existingId = useId();
  const running = task?.phase === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>SteamCMD is required</CardTitle>
        <CardDescription className="text-pretty">
          SteamCMD is Valve's command-line Steam client. The manager uses it to
          download the Enshrouded dedicated server and keep it up to date.
          Valve's licence doesn't allow it to be bundled with the app, so choose
          how you'd like to get it.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {status.availability === "missing" ? (
          <Alert className="border-warning/40 text-warning">
            <TriangleAlertIcon />
            <AlertTitle>SteamCMD has gone missing</AlertTitle>
            <AlertDescription>
              It's no longer at{" "}
              <span className="font-mono break-all">{status.executable}</span>.
              Download a fresh copy or point to where it was moved.
            </AlertDescription>
          </Alert>
        ) : null}

        <RadioGroup
          value={choice}
          onValueChange={(v) => setChoice(v as Choice)}
          className="grid gap-3 sm:grid-cols-2"
          disabled={running}
        >
          <FieldLabel htmlFor={downloadId}>
            <Field orientation="horizontal" data-disabled={!status.canDownload}>
              <FieldContent>
                <FieldTitle>
                  <DownloadIcon className="size-4 text-flame" />
                  Download it for me
                  <Badge className="bg-flame/15 text-flame">Recommended</Badge>
                </FieldTitle>
                <FieldDescription>
                  {status.canDownload
                    ? "Fetched from Valve into the app's data folder. The manager keeps it updated."
                    : "Automatic download is only available on Windows."}
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value="download"
                id={downloadId}
                disabled={!status.canDownload}
              />
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor={existingId}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>
                  <FolderSearchIcon className="size-4 text-shroud" />I already
                  have SteamCMD
                </FieldTitle>
                <FieldDescription>
                  Point the manager at an existing installation. It's used as-is
                  and never deleted.
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem value="existing" id={existingId} />
            </Field>
          </FieldLabel>
        </RadioGroup>

        <div className="rounded-lg border bg-muted/30 p-4">
          {choice === "download" ? (
            <DownloadPanel status={status} onInstall={() => void install()} />
          ) : (
            <ExistingInstallForm />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const DownloadPanel = ({
  status,
  onInstall,
}: {
  status: SteamCmdStatus;
  onInstall: () => void;
}) => {
  const { task, cancel } = useSteamCmd();
  const installTask = task?.kind === "install" ? task : null;

  if (!installTask) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Installs to</p>
          <p className="font-mono text-xs break-all text-muted-foreground">
            {status.managedDir}
          </p>
          <p className="text-xs text-muted-foreground">
            About 45 MB once SteamCMD has finished its first-run update.
          </p>
        </div>
        <Button className="shadow-glow-flame" onClick={onInstall}>
          <DownloadIcon data-icon="inline-start" />
          Download SteamCMD
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TaskProgress task={installTask} />
      {installTask.phase === "failed" && installTask.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>SteamCMD couldn't be installed</AlertTitle>
          <AlertDescription>{installTask.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        {installTask.phase === "running" ? (
          <Button variant="outline" onClick={() => void cancel()}>
            Cancel
          </Button>
        ) : (
          <Button onClick={onInstall}>
            <RotateCcwIcon data-icon="inline-start" />
            {installTask.phase === "cancelled" ? "Start again" : "Try again"}
          </Button>
        )}
      </div>
    </div>
  );
};

const ReadyCard = ({
  status,
  onContinue,
}: {
  status: SteamCmdStatus;
  onContinue: () => void;
}) => (
  <Card>
    <CardHeader className="items-center text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
        <CircleCheckBigIcon className="size-6" />
      </span>
      <CardTitle className="text-center">SteamCMD is ready</CardTitle>
      <CardDescription className="text-center">
        {status.managed
          ? "Downloaded and managed by the app. You can update or remove it later in Settings."
          : "Using your existing installation. You can change this later in Settings."}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="rounded-md border bg-muted/40 px-3 py-2 text-center font-mono text-xs break-all text-muted-foreground">
        {status.executable}
      </p>
    </CardContent>
    <CardFooter className="justify-center">
      <Button className="shadow-glow-flame" onClick={onContinue} autoFocus>
        Enter the manager
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </CardFooter>
  </Card>
);
