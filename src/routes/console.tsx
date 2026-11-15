import { createFileRoute } from "@tanstack/react-router";
import {
  ClockIcon,
  CopyIcon,
  FolderOpenIcon,
  SearchIcon,
  TerminalSquareIcon,
  WrapTextIcon,
  XIcon,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { Page, PageHeader } from "@/components/layout/page";
import { ServerConsole } from "@/components/server/server-console";
import { ServerControls } from "@/components/server/server-controls";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useServer } from "@/hooks/use-server";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { formatClock } from "@/lib/server/runtime-display";
import type { LineKind } from "@/lib/server/runtime-types";
import { startBlocker } from "@/lib/server/start-blocker";
import { steamcmdApi } from "@/lib/steamcmd/api";

type Show = "all" | "notes" | "errors";

const SHOW_KINDS: Record<Show, LineKind[] | null> = {
  all: null,
  notes: ["info", "error"],
  errors: ["error"],
};

const IconToggle = ({
  label,
  pressed,
  onPressedChange,
  children,
}: {
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Toggle
        size="sm"
        aria-label={label}
        pressed={pressed}
        onPressedChange={onPressedChange}
        className="size-7 min-w-7 text-muted-foreground data-[state=on]:bg-foreground/[0.08] data-[state=on]:text-foreground"
      >
        {children}
      </Toggle>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const Console = () => {
  const log = useServerRuntime((s) => s.log);
  const status = useServerRuntime((s) => s.status);
  const settings = useServerRuntime((s) => s.settings);
  const files = useServer().status;
  const { task } = useSteamCmd();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [timestamps, setTimestamps] = useState(true);
  const [wrap, setWrap] = useState(true);
  // Filtering thousands of lines shouldn't hold up typing.
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const lines = useMemo(() => {
    const kinds = SHOW_KINDS[show];
    return log.filter(
      (l) =>
        (!kinds || kinds.includes(l.kind)) &&
        (!deferredQuery || l.text.toLowerCase().includes(deferredQuery)),
    );
  }, [log, deferredQuery, show]);
  const live = status?.phase === "starting" || status?.phase === "running";
  const filtered = Boolean(deferredQuery) || show !== "all";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        lines.map((l) => `${formatClock(l.at)}  ${l.text}`).join("\n"),
      );
      toast.success(
        `Copied ${lines.length} ${lines.length === 1 ? "line" : "lines"}`,
      );
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  return (
    <Page width="full" className="h-(--page-height) min-h-[32rem] gap-6 pb-6">
      <PageHeader
        eyebrow={settings?.name ?? "Enshrouded server"}
        title="Console"
        description="Live output from the server, kept for this session. The full history is in its log files."
        actions={
          <>
            {settings ? (
              <Button
                variant="ghost"
                onClick={() => void steamcmdApi().reveal(settings.logDir)}
              >
                <FolderOpenIcon data-icon="inline-start" />
                Log files
              </Button>
            ) : null}
            {files && files.state !== "notInstalled" ? (
              <ServerControls
                blockedReason={startBlocker(files, task, status)}
              />
            ) : null}
          </>
        }
      />
      <ServerConsole
        lines={lines}
        live={live}
        timestamps={timestamps}
        wrap={wrap}
        highlight={deferredQuery}
        className="flex-1"
        empty={
          filtered ? (
            "No lines match. Try another search, or show every line."
          ) : (
            <div className="space-y-3">
              <TerminalSquareIcon className="mx-auto size-8 opacity-40" />
              <p>
                The console is quiet.
                <br />
                Output appears here as soon as the server starts.
              </p>
            </div>
          )
        }
        toolbar={
          <>
            <ToggleGroup
              type="single"
              size="sm"
              value={show}
              onValueChange={(v) => v && setShow(v as Show)}
              aria-label="Which lines to show"
              className="rounded-md bg-foreground/[0.04] p-0.5"
            >
              <ToggleGroupItem value="all" className="h-6 px-2.5 text-xs">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="notes" className="h-6 px-2.5 text-xs">
                Notes
              </ToggleGroupItem>
              <ToggleGroupItem value="errors" className="h-6 px-2.5 text-xs">
                Errors
              </ToggleGroupItem>
            </ToggleGroup>
            <InputGroup className="h-7 w-60">
              <InputGroupAddon>
                <SearchIcon className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find in output"
                aria-label="Find in the console output"
                className="text-xs"
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {lines.length}
                  </span>
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <div className="flex items-center">
              <IconToggle
                label="Timestamps"
                pressed={timestamps}
                onPressedChange={setTimestamps}
              >
                <ClockIcon className="size-3.5" />
              </IconToggle>
              <IconToggle
                label="Wrap long lines"
                pressed={wrap}
                onPressedChange={setWrap}
              >
                <WrapTextIcon className="size-3.5" />
              </IconToggle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground"
                    aria-label="Copy these lines"
                    disabled={!lines.length}
                    onClick={() => void copy()}
                  >
                    <CopyIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy these lines</TooltipContent>
              </Tooltip>
            </div>
          </>
        }
      />
    </Page>
  );
};

export const Route = createFileRoute("/console")({
  component: Console,
});
