import { PlayIcon, RotateCcwIcon, SquareIcon, ZapOffIcon } from "lucide-react";
import { useState } from "react";

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
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import {
  type RuntimeAction,
  useRuntimeStatus,
  useServerActions,
} from "@/hooks/use-server-runtime";

/** A shutdown taking longer than this offers to force it. Saving a big
 * world takes a while; it's normally a few seconds. */
const OFFER_FORCE_AFTER_MS = 20_000;

const playersText = (n: number) =>
  n === 1 ? "1 player is" : `${n} players are`;

type ConfirmProps = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
};

/** Wraps a trigger button in a confirmation dialog. */
const Confirm = ({
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  children,
}: ConfirmProps) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

type ServerControlsProps = {
  /** Why the server can't be started right now (e.g. not installed). */
  blockedReason?: string | null;
  size?: "sm" | "default";
};

/** Start / Stop / Restart for the server, reflecting its live state. */
export const ServerControls = ({
  blockedReason = null,
  size = "default",
}: ServerControlsProps) => {
  const status = useRuntimeStatus();
  const actions = useServerActions();
  const [pending, setPending] = useState<RuntimeAction | null>(null);
  const phase = status?.phase ?? "stopped";
  const now = useNow(1000, phase === "stopping");
  const players = status?.query?.players ?? 0;

  const run = (action: RuntimeAction, op: () => Promise<boolean>) => () => {
    setPending(action);
    void op().finally(() => setPending(null));
  };

  if (!status) {
    return (
      <Button size={size} disabled>
        <Spinner data-icon="inline-start" />
        Loading…
      </Button>
    );
  }

  if (phase === "stopped") {
    const disabled = Boolean(blockedReason) || pending !== null;
    const start = (
      <Button
        size={size}
        className="min-w-36"
        disabled={disabled}
        onClick={run("start", actions.start)}
      >
        {pending === "start" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <PlayIcon data-icon="inline-start" />
        )}
        Start server
      </Button>
    );
    return blockedReason ? (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A disabled button gets no pointer events, so the tooltip hangs
              off a wrapper. */}
          <span>{start}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{blockedReason}</TooltipContent>
      </Tooltip>
    ) : (
      start
    );
  }

  if (phase === "stopping") {
    const waitedMs = status.stopRequestedAt ? now - status.stopRequestedAt : 0;
    return (
      <>
        <Button size={size} variant="outline" disabled>
          <Spinner data-icon="inline-start" />
          Saving and stopping…
        </Button>
        {waitedMs > OFFER_FORCE_AFTER_MS ? (
          <Confirm
            title="Force the server to close?"
            description="It's still saving or shutting down. Forcing it closes it straight away: anything since its last save is lost, and a save in progress could be damaged."
            confirmLabel="Force close"
            destructive
            onConfirm={run("kill", actions.kill)}
          >
            <Button
              size={size}
              variant="destructive"
              disabled={pending !== null}
            >
              <ZapOffIcon data-icon="inline-start" />
              Force close
            </Button>
          </Confirm>
        ) : null}
      </>
    );
  }

  // With players online, Stop and Restart ask first; the button then just
  // opens the dialog.
  const confirmFirst = players > 0;
  const stopButton = (
    <Button
      size={size}
      variant="outline"
      className="text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
      disabled={pending !== null}
      onClick={confirmFirst ? undefined : run("stop", actions.stop)}
    >
      {pending === "stop" ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <SquareIcon data-icon="inline-start" />
      )}
      Stop
    </Button>
  );
  const restartButton = (
    <Button
      size={size}
      variant="outline"
      disabled={pending !== null}
      onClick={confirmFirst ? undefined : run("restart", actions.restart)}
    >
      {pending === "restart" ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RotateCcwIcon data-icon="inline-start" />
      )}
      Restart
    </Button>
  );

  return (
    <>
      {phase === "starting" ? (
        <Button size={size} variant="outline" disabled>
          <Spinner data-icon="inline-start" />
          Starting…
        </Button>
      ) : confirmFirst ? (
        <Confirm
          title="Restart the server?"
          description={`${playersText(players)} online and will be disconnected while it restarts. The world is saved first.`}
          confirmLabel="Restart"
          onConfirm={run("restart", actions.restart)}
        >
          {restartButton}
        </Confirm>
      ) : (
        restartButton
      )}
      {confirmFirst ? (
        <Confirm
          title="Stop the server?"
          description={`${playersText(players)} online and will be disconnected. The world is saved before it stops.`}
          confirmLabel="Stop server"
          destructive
          onConfirm={run("stop", actions.stop)}
        >
          {stopButton}
        </Confirm>
      ) : (
        stopButton
      )}
    </>
  );
};
