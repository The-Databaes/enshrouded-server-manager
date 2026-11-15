import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ArrowRightIcon, FileCogIcon, FolderOpenIcon } from "lucide-react";

import { Detail, DetailList, Section, Unknown } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRuntimeStatus } from "@/hooks/use-server-runtime";
import type { ServerStatus } from "@/lib/server/types";
import { steamcmdApi } from "@/lib/steamcmd/api";

export const RevealButton = ({
  path,
  label,
  icon: Icon = FolderOpenIcon,
}: {
  path: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        aria-label={label}
        onClick={() => void steamcmdApi().reveal(path)}
      >
        <Icon className="size-3.5" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const Ago = ({ secs }: { secs: number }) => (
  <time
    dateTime={new Date(secs * 1000).toISOString()}
    title={new Date(secs * 1000).toLocaleString()}
  >
    {formatDistanceToNow(secs * 1000, { addSuffix: true })}
  </time>
);

/** The server's own settings and where its world lives. */
export const ServerDetails = ({ files }: { files: ServerStatus }) => {
  const runtime = useRuntimeStatus();
  const settings = files.settings;
  const version = runtime?.phase === "running" ? runtime.query?.version : null;
  const everywhere =
    settings && (settings.ip === "0.0.0.0" || settings.ip === "::");
  const settingsFile = files.installDir
    ? `${files.installDir}\\enshrouded_server.json`
    : null;

  return (
    <Section
      title="Details"
      variant="panel"
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/server-settings">
            Edit
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      }
    >
      <DetailList>
        <Detail label="Port">
          {settings ? (
            <span className="tabular-nums">
              {settings.queryPort}{" "}
              <Unknown>UDP{everywhere ? "" : ` on ${settings.ip}`}</Unknown>
            </span>
          ) : (
            <Unknown />
          )}
        </Detail>
        <Detail label="Player slots">
          {settings ? settings.slotCount : <Unknown />}
        </Detail>
        <Detail label="Build">
          {files.buildId ? (
            <span className="font-mono text-xs">{files.buildId}</span>
          ) : (
            <Unknown />
          )}
          {files.updateAvailable ? (
            <Link
              to="/servers"
              className="ml-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning hover:bg-warning/25"
            >
              Update
            </Link>
          ) : null}
        </Detail>
        {version ? (
          <Detail label="Version">
            <span className="tabular-nums">{version}</span>
          </Detail>
        ) : null}
        <Detail label="World saved">
          {files.lastSavedAt ? (
            <Ago secs={files.lastSavedAt} />
          ) : (
            <Unknown>Not yet</Unknown>
          )}
          {/* The folder only exists once the server has saved. */}
          {settings && files.lastSavedAt ? (
            <RevealButton path={settings.saveDir} label="Show save folder" />
          ) : null}
        </Detail>
        <Detail label="Settings file">
          {settings?.file === "missing" ? (
            <Unknown>Created on first start</Unknown>
          ) : settings?.file === "invalid" ? (
            <span className="text-warning">Can't be read</span>
          ) : (
            <span className="truncate">enshrouded_server.json</span>
          )}
          {settingsFile && settings?.file !== "missing" ? (
            <RevealButton
              path={settingsFile}
              label="Show settings file"
              icon={FileCogIcon}
            />
          ) : null}
        </Detail>
      </DetailList>
    </Section>
  );
};
