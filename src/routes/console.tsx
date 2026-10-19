import { createFileRoute } from "@tanstack/react-router";
import { FolderOpenIcon, SearchIcon, XIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { PageHeader } from "@/components/app-shell/app-shell";
import { ServerConsole } from "@/components/server/server-console";
import { Badge, BadgeDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { phaseView } from "@/lib/server/runtime-display";
import { steamcmdApi } from "@/lib/steamcmd/api";

const Console = () => {
  const log = useServerRuntime((s) => s.log);
  const status = useServerRuntime((s) => s.status);
  const logDir = useServerRuntime((s) => s.settings?.logDir ?? null);
  const [query, setQuery] = useState("");
  // Filtering thousands of lines shouldn't hold up typing.
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const lines = useMemo(
    () =>
      deferredQuery
        ? log.filter((l) => l.text.toLowerCase().includes(deferredQuery))
        : log,
    [log, deferredQuery],
  );
  const view = phaseView(status);
  const live = status?.phase === "starting" || status?.phase === "running";

  return (
    <>
      <PageHeader
        title="Console"
        description="Live output from the server. The full history is in its log files."
        actions={
          <>
            <Badge variant={view.tone}>
              <BadgeDot />
              {view.label}
            </Badge>
            {logDir ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void steamcmdApi().reveal(logDir)}
              >
                <FolderOpenIcon data-icon="inline-start" />
                Log files
              </Button>
            ) : null}
          </>
        }
      />
      <ServerConsole
        lines={lines}
        live={live}
        className="flex min-h-0 flex-1 flex-col"
        viewportClassName="h-[calc(100svh-var(--titlebar-height)-15rem)] min-h-64"
        emptyText={
          deferredQuery
            ? "No lines match the filter."
            : "Nothing yet. Output appears here when the server starts."
        }
        toolbar={
          <InputGroup className="h-6 w-56">
            <InputGroupAddon>
              <SearchIcon className="size-3" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter lines"
              aria-label="Filter console lines"
              className="text-xs"
            />
            {query ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear filter"
                  onClick={() => setQuery("")}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        }
      />
    </>
  );
};

export const Route = createFileRoute("/console")({
  component: Console,
});
