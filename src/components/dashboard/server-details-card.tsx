import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  FileCogIcon,
  FolderOpenIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRuntimeStatus } from "@/hooks/use-server-runtime";
import type { ServerStatus } from "@/lib/server/types";
import { steamcmdApi } from "@/lib/steamcmd/api";

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 py-2 text-sm">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="flex min-w-0 items-center justify-end gap-1 text-right">
      {children}
    </dd>
  </div>
);

const RevealButton = ({
  path,
  label,
  icon: Icon,
}: {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={label}
        onClick={() => void steamcmdApi().reveal(path)}
      >
        <Icon className="size-3.5" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

/** The server's own settings and where its world lives. */
export const ServerDetailsCard = ({
  files,
  className,
}: {
  files: ServerStatus;
  className?: string;
}) => {
  const runtime = useRuntimeStatus();
  const settings = files.settings;
  const version = runtime?.phase === "running" ? runtime.query?.version : null;
  const listenIp =
    settings && (settings.ip === "0.0.0.0" || settings.ip === "::")
      ? "all network adapters"
      : settings?.ip;
  const settingsFile = files.installDir
    ? `${files.installDir}\\enshrouded_server.json`
    : null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Server details</CardTitle>
        <CardDescription>
          From the server's enshrouded_server.json
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link to="/server-settings">
              <SlidersHorizontalIcon data-icon="inline-start" />
              Edit
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border/60">
          <Row label="Name">
            <span className="truncate font-medium">
              {settings?.name ?? <Muted>—</Muted>}
            </span>
          </Row>
          <Row label="Query port">
            {settings ? (
              <span className="tabular-nums">
                {settings.queryPort} <Muted>UDP, on {listenIp}</Muted>
              </span>
            ) : (
              <Muted>—</Muted>
            )}
          </Row>
          <Row label="Player slots">
            {settings ? settings.slotCount : <Muted>—</Muted>}
          </Row>
          <Row label="Version">
            {version ? (
              <span className="tabular-nums">{version}</span>
            ) : (
              <Muted>Shown while running</Muted>
            )}
            {files.buildId ? (
              <Muted>
                {" "}
                · build{" "}
                <span className="font-mono text-xs">{files.buildId}</span>
              </Muted>
            ) : null}
            {files.updateAvailable ? (
              <Badge variant="warning" className="ml-1">
                Update available
              </Badge>
            ) : null}
          </Row>
          <Row label="World last saved">
            {files.lastSavedAt ? (
              <time
                dateTime={new Date(files.lastSavedAt * 1000).toISOString()}
                title={new Date(files.lastSavedAt * 1000).toLocaleString()}
              >
                {formatDistanceToNow(files.lastSavedAt * 1000, {
                  addSuffix: true,
                })}
              </time>
            ) : (
              <Muted>Not saved yet</Muted>
            )}
            {/* The folder only exists once the server has saved. */}
            {settings && files.lastSavedAt ? (
              <RevealButton
                path={settings.saveDir}
                label="Show save folder"
                icon={FolderOpenIcon}
              />
            ) : null}
          </Row>
          <Row label="Settings file">
            {settings?.file === "missing" ? (
              <Muted>Created on first start</Muted>
            ) : settings?.file === "invalid" ? (
              <span className="text-warning">Couldn't be read</span>
            ) : (
              <span>enshrouded_server.json</span>
            )}
            {settingsFile && settings?.file !== "missing" ? (
              <RevealButton
                path={settingsFile}
                label="Show settings file"
                icon={FileCogIcon}
              />
            ) : null}
          </Row>
        </dl>
      </CardContent>
    </Card>
  );
};
