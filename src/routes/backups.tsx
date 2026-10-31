import { createFileRoute } from "@tanstack/react-router";
import { ArchiveIcon, FolderOpenIcon, HistoryIcon } from "lucide-react";

import { Ago } from "@/components/dashboard/server-details";
import {
  Fact,
  Facts,
  Page,
  PageHeader,
  Section,
  Unknown,
} from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { useServer } from "@/hooks/use-server";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { steamcmdApi } from "@/lib/steamcmd/api";

/** Restore points still to come, drawn as a faint timeline. */
const FutureTimeline = () => (
  <div aria-hidden="true" className="relative flex items-center gap-0 py-6">
    {["Now", "1 h", "6 h", "1 day", "1 week"].map((label, i) => (
      <div key={label} className="flex flex-1 flex-col items-center gap-3">
        <div className="relative flex w-full items-center">
          <span
            className={
              i === 0
                ? "h-px flex-1 bg-transparent"
                : "h-px flex-1 border-t border-dashed border-border"
            }
          />
          <span
            className={
              i === 0
                ? "size-3 rounded-full bg-ember shadow-[0_0_12px_var(--ember)]"
                : "size-2.5 rounded-full border border-dashed border-muted-foreground/60"
            }
          />
          <span
            className={
              i === 4
                ? "h-px flex-1 bg-transparent"
                : "h-px flex-1 border-t border-dashed border-border"
            }
          />
        </div>
        <span className="eyebrow text-[0.6rem]">{label}</span>
      </div>
    ))}
  </div>
);

const Backups = () => {
  const files = useServer().status;
  const settings = useServerRuntime((s) => s.settings);
  const saveDir = settings?.saveDir ?? null;
  const saved = files?.lastSavedAt ?? null;

  return (
    <Page>
      <PageHeader
        eyebrow={settings?.name ?? "Enshrouded server"}
        title="Backups"
        description="Your world, and the copies that keep it safe."
        actions={
          saveDir && saved ? (
            <Button
              variant="outline"
              onClick={() => void steamcmdApi().reveal(saveDir)}
            >
              <FolderOpenIcon data-icon="inline-start" />
              Open save folder
            </Button>
          ) : null
        }
      />

      <Facts>
        <Fact
          label="World last saved"
          hint="The server saves on its own while it runs"
        >
          {saved ? <Ago secs={saved} /> : <Unknown>Not saved yet</Unknown>}
        </Fact>
        <Fact label="Save folder" hint={saveDir ?? undefined}>
          {saveDir ? (
            <span className="font-mono text-sm">
              {saveDir.split(/[\\/]/).filter(Boolean).at(-1)}
            </span>
          ) : (
            <Unknown />
          )}
        </Fact>
      </Facts>

      <Section
        title="Restore points"
        description="Scheduled copies of the world you can roll back to."
        rule
      >
        <div className="space-y-6">
          <FutureTimeline />
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-shroud/40 bg-shroud/10 text-shroud">
              <HistoryIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-medium">Scheduled backups are on the way</p>
              <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
                Soon the manager will copy the world on a schedule and before
                every update, so you can roll back with a click. Until then,
                stop the server and copy the save folder somewhere safe before
                big changes.
              </p>
            </div>
            {saveDir && saved ? (
              <Button
                variant="ghost"
                onClick={() => void steamcmdApi().reveal(saveDir)}
              >
                <ArchiveIcon data-icon="inline-start" />
                Show the world files
              </Button>
            ) : null}
          </div>
        </div>
      </Section>
    </Page>
  );
};

export const Route = createFileRoute("/backups")({
  component: Backups,
});
