import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ArrowRightIcon,
  CheckIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect } from "react";

import { FlameBeacon } from "@/components/brand/flame-beacon";
import { ConsolePeek } from "@/components/dashboard/console-peek";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { OnlinePlayers } from "@/components/dashboard/online-players";
import { PlayerActivity } from "@/components/dashboard/player-activity";
import { ServerDetails } from "@/components/dashboard/server-details";
import { ServerHero } from "@/components/dashboard/server-hero";
import { Vitals } from "@/components/dashboard/vitals";
import { Page } from "@/components/layout/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayerHistory } from "@/hooks/use-player-history";
import { useServer } from "@/hooks/use-server";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { startBlocker } from "@/lib/server/start-blocker";

type Step = {
  title: string;
  description: string;
  done?: boolean;
  action?: React.ReactNode;
};

/** The road from a fresh app to a running server. */
const FirstSteps = () => {
  const steps: Step[] = [
    {
      title: "SteamCMD is ready",
      description: "Valve's downloader, set up when the app first opened.",
      done: true,
    },
    {
      title: "Install the dedicated server",
      description:
        "About a 3.5 GB download from Steam, no account needed. Already have the server files? Point the manager at them instead.",
      action: (
        <Button asChild>
          <Link to="/servers">
            Install the server
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      ),
    },
    {
      title: "Make it yours",
      description:
        "Name it, pick a difficulty and set the passwords your friends will use.",
    },
    {
      title: "Light the Flame",
      description: "Start it from here and watch players arrive.",
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <Page width="narrow" className="gap-14">
      <section className="hero-glow relative isolate flex flex-col items-start gap-6 pt-4">
        <FlameBeacon state="out" className="-ml-4" />
        <div className="space-y-3">
          <p className="eyebrow">Welcome</p>
          <h1 className="text-[2.4rem] leading-tight font-semibold tracking-[0.04em]">
            Let's light your first Flame
          </h1>
          <p className="max-w-xl text-pretty text-muted-foreground">
            Three steps to a world your friends can join. The manager downloads
            the server, keeps it updated and starts it for you.
          </p>
        </div>
      </section>

      <ol className="relative">
        {steps.map((step, i) => {
          const active = i === current;
          return (
            <li
              key={step.title}
              className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-5 pb-10 last:pb-0"
            >
              {i < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-10 bottom-1 left-5 w-px -translate-x-1/2",
                    step.done ? "bg-success/50" : "bg-border",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-10 items-center justify-center rounded-full border font-display text-sm font-semibold",
                  step.done && "border-success/50 bg-success/12 text-success",
                  active &&
                    "border-ember/60 bg-ember/12 text-ember shadow-[0_0_20px_-4px_var(--ember)]",
                  !step.done && !active && "text-muted-foreground",
                )}
              >
                {step.done ? <CheckIcon className="size-4" /> : i + 1}
              </span>
              <div className="space-y-2 pt-2">
                <h2
                  className={cn(
                    "font-sans text-base font-semibold tracking-normal",
                    !step.done && !active && "text-muted-foreground",
                  )}
                >
                  {step.title}
                </h2>
                <p className="max-w-lg text-sm text-pretty text-muted-foreground">
                  {step.description}
                </p>
                {active && step.action ? (
                  <div className="pt-2">{step.action}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Page>
  );
};

const DashboardSkeleton = () => (
  <Page width="wide" aria-busy="true">
    <div className="flex items-center gap-8">
      <Skeleton className="size-24 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-64 w-full" />
  </Page>
);

const Dashboard = () => {
  const server = useServer();
  const { task } = useSteamCmd();
  const runtime = useServerRuntime((s) => s.status);
  const history = usePlayerHistory();
  const files = server.status;

  // Starting writes the server's settings file the first time, and stopping
  // saves the world: re-read both when the phase changes.
  const phase = runtime?.phase;
  const { refresh } = server;
  useEffect(() => {
    if (phase) void refresh();
  }, [phase, refresh]);

  if (!files) {
    return server.loadError ? (
      <Page width="narrow">
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Couldn't read the server's status</AlertTitle>
          <AlertDescription>
            <p>{server.loadError.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => void refresh()}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </Page>
    ) : (
      <DashboardSkeleton />
    );
  }

  if (files.state === "notInstalled") return <FirstSteps />;

  return (
    <Page width="wide" className="gap-8">
      <ServerHero
        files={files}
        blockedReason={startBlocker(files, task, runtime)}
      >
        <DashboardAlerts files={files} />
      </ServerHero>

      <Vitals history={history} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <PlayerActivity history={history} variant="panel" />
          <OnlinePlayers />
        </div>
        <div className="min-w-0 space-y-4">
          <ConsolePeek />
          <ServerDetails files={files} />
        </div>
      </div>
    </Page>
  );
};

export const Route = createFileRoute("/")({
  component: Dashboard,
});
