import { cn } from "cn";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleDashedIcon,
  CircleFadingArrowUpIcon,
  ExternalLinkIcon,
  InfoIcon,
  type LucideIcon,
  RefreshCwIcon,
  WifiOffIcon,
} from "lucide-react";
import { useId } from "react";

import { SettingList, SettingRow } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useNow } from "@/hooks/use-now";
import { useUpdateActions, useUpdater } from "@/hooks/use-updater";
import {
  downloadPercent,
  type UpdateStatus,
  updateStatus,
} from "@/lib/app/update-store";

type Tone =
  | "neutral"
  | "ember"
  | "success"
  | "info"
  | "warning"
  | "destructive";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-foreground/[0.04] text-muted-foreground",
  ember:
    "border-ember/40 bg-ember/12 text-ember shadow-[0_0_20px_-6px_var(--ember)]",
  success: "border-success/35 bg-success/12 text-success",
  info: "border-info/35 bg-info/12 text-info",
  warning: "border-warning/35 bg-warning/12 text-warning",
  destructive: "border-destructive/35 bg-destructive/12 text-destructive",
};

const LOOKS: Record<
  UpdateStatus,
  { icon: LucideIcon | "spinner"; tone: Tone }
> = {
  unknown: { icon: CircleDashedIcon, tone: "neutral" },
  checking: { icon: "spinner", tone: "neutral" },
  upToDate: { icon: CheckIcon, tone: "success" },
  available: { icon: CircleFadingArrowUpIcon, tone: "ember" },
  installing: { icon: "spinner", tone: "ember" },
  noRelease: { icon: InfoIcon, tone: "info" },
  offline: { icon: WifiOffIcon, tone: "warning" },
  failed: { icon: AlertTriangleIcon, tone: "destructive" },
};

const ago = (at: number) => formatDistanceToNow(at, { addSuffix: true });

/** Where the manager's updates stand, with the controls that go with it. */
const StatusPanel = () => {
  const state = useUpdater((s) => s);
  const actions = useUpdateActions();
  // Keeps "checked 5 minutes ago" honest.
  useNow(30_000);
  const status = updateStatus(state);
  const { icon: Icon, tone } = LOOKS[status];
  const { currentVersion: current, update, lastCheck, install } = state;
  const checked = lastCheck ? `checked ${ago(lastCheck.at)}` : null;
  const yours = current ? `Version ${current}` : "This version";

  const [headline, detail] = ((): [string, string] => {
    switch (status) {
      case "unknown":
        return [
          "Not checked yet",
          state.autoCheck
            ? `${yours} · the manager checks shortly after it starts`
            : yours,
        ];
      case "checking":
        return ["Checking for updates…", yours];
      case "upToDate":
        return [
          "You're up to date",
          [yours, checked].filter(Boolean).join(" · "),
        ];
      case "available":
        return [
          `Version ${update?.version} is available`,
          [
            current ? `You have ${current}` : null,
            update?.date ? `released ${ago(update.date)}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        ];
      case "installing": {
        const percent = install ? downloadPercent(install) : null;
        return [
          `Installing version ${update?.version}`,
          install?.step === "downloading" && percent !== null
            ? `Downloading · ${Math.floor(percent)}%`
            : "Follow along in the update window",
        ];
      }
      case "noRelease":
        return [
          "No releases published yet",
          [yours, checked].filter(Boolean).join(" · "),
        ];
      case "offline":
        return [
          "Couldn't reach the update server",
          `${checked ? `Last ${checked}` : "Not checked"} · it tries again when you're back online`,
        ];
      case "failed":
        return ["Couldn't check for updates", lastCheck?.error?.message ?? ""];
    }
  })();

  const busy = status === "checking" || status === "installing";

  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors",
          TONES[tone],
        )}
      >
        {Icon === "spinner" ? (
          <Spinner className="size-5" />
        ) : (
          <Icon className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="font-semibold">{headline}</p>
        <p className="text-sm text-pretty text-muted-foreground tabular-nums">
          {detail}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "available" || status === "installing" ? (
          <Button onClick={actions.openDialog}>
            {status === "installing" ? "Show progress" : "See what's new"}
          </Button>
        ) : null}
        {status === "installing" ? null : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void actions.check()}
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={cn(
                status === "checking" && "motion-safe:animate-spin",
              )}
            />
            Check now
          </Button>
        )}
      </div>
    </div>
  );
};

/** App settings → Updates. */
export const UpdatesSettings = () => {
  const autoId = useId();
  const resumeId = useId();
  const autoCheck = useUpdater((s) => s.autoCheck);
  const resume = useUpdater((s) => s.resumeServer);
  const skipped = useUpdater((s) => s.skippedVersion);
  const actions = useUpdateActions();

  return (
    <div className="space-y-6">
      <StatusPanel />
      <SettingList>
        <SettingRow
          control="sm"
          label="Check automatically"
          htmlFor={autoId}
          description="When the manager starts, then every six hours while it's open. Nothing is installed without asking you."
        >
          <Switch
            id={autoId}
            checked={autoCheck}
            onCheckedChange={actions.setAutoCheck}
          />
        </SettingRow>
        <SettingRow
          control="sm"
          label="Start the server again after updating"
          htmlFor={resumeId}
          description="Installing an update stops a running server, and the world saves first. This starts it again once the manager is back."
        >
          <Switch
            id={resumeId}
            checked={resume}
            onCheckedChange={actions.setResumeServer}
          />
        </SettingRow>
        {skipped ? (
          <SettingRow
            control="sm"
            label="Skipped version"
            description={`You chose to skip version ${skipped}, so it isn't announced. Newer versions still are.`}
          >
            <Button variant="outline" size="sm" onClick={actions.unskip}>
              Announce it again
            </Button>
          </SettingRow>
        ) : null}
      </SettingList>
      <button
        type="button"
        onClick={() => actions.openReleasePage()}
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        Every release and its notes, on GitHub
        <ExternalLinkIcon className="size-3.5" />
      </button>
    </div>
  );
};
