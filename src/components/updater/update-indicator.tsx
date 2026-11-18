import { cn } from "cn";
import { ChevronRightIcon, CircleFadingArrowUpIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUpdateActions, useUpdater } from "@/hooks/use-updater";
import { downloadPercent } from "@/lib/app/update-store";

/**
 * The manager's own update, in the sidebar: a quiet invitation when one is
 * out (unless it was skipped), the progress while it installs. Either opens
 * the update dialog.
 */
export const UpdateIndicator = ({ collapsed }: { collapsed: boolean }) => {
  const update = useUpdater((s) => s.update);
  const skipped = useUpdater((s) => s.skippedVersion);
  const progress = useUpdater((s) => s.install);
  const failed = useUpdater((s) => s.installError !== null);
  const { openDialog } = useUpdateActions();

  if (!update || (!progress && update.version === skipped)) return null;

  const committed =
    progress?.step === "stoppingServer" || progress?.step === "installing";
  const percent = progress ? downloadPercent(progress) : null;
  const title = progress
    ? committed
      ? "Installing update"
      : "Downloading update"
    : "Update available";
  const detail = progress
    ? committed
      ? "The manager restarts by itself"
      : percent === null
        ? `Version ${update.version}`
        : `${Math.floor(percent)}% of version ${update.version}`
    : failed
      ? "The last try didn't finish"
      : `Version ${update.version} is ready`;

  const button = (
    <button
      type="button"
      onClick={openDialog}
      aria-label={collapsed ? `${title}: ${detail}` : undefined}
      className={cn(
        "group/update relative block w-full rounded-lg border border-ember/30 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--ember)_12%,transparent),color-mix(in_oklch,var(--ember)_3%,transparent))] text-left transition-colors outline-none hover:border-ember/55 focus-visible:ring-2 focus-visible:ring-ring/60",
        collapsed ? "flex h-9 items-center justify-center" : "px-2.5 py-2",
      )}
    >
      {collapsed ? (
        <>
          {progress ? (
            <Spinner className="size-4 text-ember" />
          ) : (
            <CircleFadingArrowUpIcon className="size-4 text-ember" />
          )}
          {progress ? null : (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-ember shadow-[0_0_6px_var(--ember)]" />
          )}
        </>
      ) : (
        <>
          <span className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ember/15 text-ember">
              {committed ? (
                <Spinner className="size-3.5" />
              ) : (
                <CircleFadingArrowUpIcon className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {title}
              </span>
              <span className="block truncate text-xs text-muted-foreground tabular-nums">
                {detail}
              </span>
            </span>
            {progress ? null : (
              <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/update:translate-x-0.5 motion-reduce:transition-none" />
            )}
          </span>
          {progress && !committed ? (
            <Progress
              value={percent ?? 100}
              aria-label="Update download"
              className={cn(
                "mt-2 h-1",
                percent === null && "opacity-60 motion-safe:animate-pulse",
              )}
            />
          ) : null}
        </>
      )}
    </button>
  );

  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {title} · {detail}
      </TooltipContent>
    </Tooltip>
  ) : (
    button
  );
};
