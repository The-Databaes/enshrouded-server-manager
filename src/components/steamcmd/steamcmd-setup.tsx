import { cn } from "cn";
import {
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  FolderSearchIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useState } from "react";

import { FlameBeacon } from "@/components/brand/flame-beacon";
import { LogoMark } from "@/components/brand/logo";
import { ExistingInstallForm } from "@/components/steamcmd/existing-install-form";
import { TaskProgress } from "@/components/steamcmd/task-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import type { SteamCmdStatus } from "@/lib/steamcmd/types";

type Choice = "download" | "existing";

const JOURNEY = [
  "Get SteamCMD",
  "Install the server",
  "Make it yours",
  "Light the Flame",
];

/** The brand side of the setup screen, with where this step sits. */
const Story = ({ ready }: { ready: boolean }) => (
  <aside className="relative hidden overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex lg:w-[26rem] lg:shrink-0 lg:flex-col lg:justify-between lg:p-10">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(70% 45% at 30% 100%, color-mix(in oklch, var(--shroud) 28%, transparent), transparent 70%), radial-gradient(50% 35% at 20% 10%, color-mix(in oklch, var(--ember) 14%, transparent), transparent 70%)",
      }}
    />
    <div className="relative flex items-center gap-3">
      <LogoMark className="size-12 rounded-[22%] shadow-ember" />
      <div className="leading-tight">
        <p className="font-display text-lg font-bold tracking-[0.12em]">
          ENSHROUDED
        </p>
        <p className="eyebrow text-[0.6rem] text-shroud">Server Manager</p>
      </div>
    </div>

    <div className="relative space-y-8">
      <p className="font-display text-[1.65rem] leading-snug font-semibold tracking-[0.03em] text-balance">
        Keep the Flame burning for everyone in Embervale.
      </p>
      <ol className="space-y-4">
        {JOURNEY.map((step, i) => {
          const done = ready && i === 0;
          const current = ready ? i === 1 : i === 0;
          return (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border font-display text-xs font-semibold",
                  done && "border-success/50 bg-success/12 text-success",
                  current &&
                    "border-ember/60 bg-ember/12 text-ember shadow-[0_0_16px_-4px_var(--ember)]",
                  !done && !current && "text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  current
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </div>

    <p className="relative text-xs text-muted-foreground">
      SteamCMD is made by Valve Corporation and is downloaded directly from
      Valve's servers.
    </p>
  </aside>
);

const ChoiceTile = ({
  value,
  icon: Icon,
  title,
  badge,
  description,
  disabled,
}: {
  value: Choice;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  description: string;
  disabled?: boolean;
}) => (
  <RadioGroupPrimitive.Item
    value={value}
    disabled={disabled}
    className="group flex flex-col gap-3 rounded-xl border border-border/80 p-4 text-left transition-all outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:border-ember/60 data-[state=checked]:bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklch,var(--ember)_12%,transparent),transparent_70%)] data-[state=checked]:shadow-[0_0_24px_-12px_var(--ember)]"
  >
    <span className="flex items-center justify-between">
      <span className="flex size-9 items-center justify-center rounded-lg border bg-foreground/[0.03] text-muted-foreground group-data-[state=checked]:border-ember/50 group-data-[state=checked]:bg-ember/12 group-data-[state=checked]:text-ember">
        <Icon className="size-4" />
      </span>
      <span className="size-3.5 rounded-full border-2 border-border group-data-[state=checked]:border-ember group-data-[state=checked]:bg-ember group-data-[state=checked]:shadow-[0_0_8px_var(--ember)]" />
    </span>
    <span className="space-y-1">
      <span className="flex items-center gap-2 text-sm font-semibold">
        {title}
        {badge ? (
          <span className="rounded-full bg-ember/15 px-2 py-0.5 text-xs font-semibold text-ember">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="block text-xs text-pretty text-muted-foreground">
        {description}
      </span>
    </span>
  </RadioGroupPrimitive.Item>
);

const DownloadPanel = ({ status }: { status: SteamCmdStatus }) => {
  const { task, install, cancel } = useSteamCmd();
  const installTask = task?.kind === "install" ? task : null;

  if (!installTask) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <p className="eyebrow">Installs to</p>
          <p className="font-mono text-xs break-all">{status.managedDir}</p>
          <p className="text-xs text-muted-foreground">
            About 45 MB once SteamCMD has finished its first-run update.
          </p>
        </div>
        <Button size="lg" onClick={() => void install()}>
          <DownloadIcon data-icon="inline-start" />
          Download SteamCMD
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TaskProgress task={installTask} onCancel={() => void cancel()} />
      {installTask.phase !== "running" ? (
        <Button onClick={() => void install()}>
          <RotateCcwIcon data-icon="inline-start" />
          {installTask.phase === "cancelled" ? "Start again" : "Try again"}
        </Button>
      ) : null}
    </div>
  );
};

const SetupForm = ({ status }: { status: SteamCmdStatus }) => {
  const { task } = useSteamCmd();
  const [choice, setChoice] = useState<Choice>(
    status.canDownload ? "download" : "existing",
  );
  const running = task?.phase === "running";

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="eyebrow">Step 1 of 4</p>
        <h1 className="text-[2.2rem] leading-tight font-semibold tracking-[0.04em]">
          Before the Flame is lit
        </h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          The manager uses SteamCMD, Valve's command-line Steam client, to
          download the Enshrouded server and keep it up to date. Valve's licence
          doesn't allow it to be bundled, so choose how to get it.
        </p>
      </header>

      {status.availability === "missing" ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>SteamCMD has gone missing</AlertTitle>
          <AlertDescription>
            It's no longer at{" "}
            <span className="font-mono break-all">{status.executable}</span>.
            Download a fresh copy or point to where it was moved.
          </AlertDescription>
        </Alert>
      ) : null}

      <RadioGroupPrimitive.Root
        value={choice}
        onValueChange={(v) => setChoice(v as Choice)}
        disabled={running}
        aria-label="How to get SteamCMD"
        className="grid gap-3 sm:grid-cols-2"
      >
        <ChoiceTile
          value="download"
          icon={DownloadIcon}
          title="Download it for me"
          badge="Recommended"
          disabled={!status.canDownload}
          description={
            status.canDownload
              ? "Fetched from Valve into the app's data folder and kept updated."
              : "Automatic download is only available on Windows."
          }
        />
        <ChoiceTile
          value="existing"
          icon={FolderSearchIcon}
          title="I already have SteamCMD"
          description="Point the manager at your installation. It's used as-is and never deleted."
        />
      </RadioGroupPrimitive.Root>

      <div key={choice} className="animate-page-in">
        {choice === "download" ? (
          <DownloadPanel status={status} />
        ) : (
          <ExistingInstallForm />
        )}
      </div>
    </div>
  );
};

const Ready = ({
  status,
  onContinue,
}: {
  status: SteamCmdStatus;
  onContinue: () => void;
}) => (
  <div className="flex animate-rise-in flex-col items-start gap-8">
    <FlameBeacon state="lit" className="-ml-4" />
    <header className="space-y-3">
      <p className="eyebrow text-success">Step 1 done</p>
      <h1 className="text-[2.2rem] leading-tight font-semibold tracking-[0.04em]">
        The path is clear
      </h1>
      <p className="max-w-xl text-pretty text-muted-foreground">
        {status.managed
          ? "SteamCMD is downloaded and the manager keeps it updated. You can change this later in App settings."
          : "The manager will use your SteamCMD. You can change this later in App settings."}
      </p>
    </header>
    <p className="max-w-full truncate rounded-lg border bg-console px-4 py-2.5 font-mono text-xs text-muted-foreground">
      {status.executable}
    </p>
    <Button size="lg" onClick={onContinue} autoFocus>
      Continue to the server
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  </div>
);

/** Full-window first-run screen: get SteamCMD before anything else. */
export const SteamCmdSetup = ({
  status,
  onContinue,
}: {
  status: SteamCmdStatus;
  onContinue: () => void;
}) => {
  const ready = status.availability === "ready";
  return (
    <div className="flex min-h-full">
      <Story ready={ready} />
      <main className="flex min-w-0 flex-1 items-center justify-center p-8 sm:p-14">
        <div className="w-full max-w-2xl animate-page-in">
          {ready ? (
            <Ready status={status} onContinue={onContinue} />
          ) : (
            <SetupForm status={status} />
          )}
        </div>
      </main>
    </div>
  );
};
