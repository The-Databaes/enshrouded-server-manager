import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  CopyIcon,
  ShieldBanIcon,
  ShieldOffIcon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ListNotice } from "@/components/dashboard/online-players";
import { PlayerActivity } from "@/components/dashboard/player-activity";
import {
  Fact,
  Facts,
  Page,
  PageHeader,
  Section,
} from "@/components/layout/page";
import { PlayerAvatar } from "@/components/player-avatar";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { usePlayerHistory } from "@/hooks/use-player-history";
import { useRuntimeStatus, useServerRuntime } from "@/hooks/use-server-runtime";
import { formatDuration } from "@/lib/server/runtime-display";
import type { OnlinePlayer } from "@/lib/server/runtime-types";
import { type SettingsFile, settingsApi } from "@/lib/server/settings-api";
import { type Ban, bansOf } from "@/lib/server/settings-editor";
import { toAppError } from "@/lib/steamcmd/api";

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
};

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const OnlineRow = ({ player, now }: { player: OnlinePlayer; now: number }) => (
  <tr className="group border-b border-border/55 last:border-0">
    <td className="py-3 pr-4">
      <div className="flex items-center gap-3">
        <PlayerAvatar name={player.name} seed={player.steamId} />
        <span className="truncate font-medium">
          {player.name ?? (
            <span className="font-normal text-muted-foreground italic">
              Unnamed player
            </span>
          )}
        </span>
      </div>
    </td>
    <td className="py-3 pr-4">
      {player.steamId ? (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
          {player.steamId}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Copy ${player.name ?? "the player"}'s Steam ID`}
                onClick={() => void copy(player.steamId ?? "", "Steam ID")}
              >
                <CopyIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy Steam ID</TooltipContent>
          </Tooltip>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </td>
    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
      {player.handle ?? "—"}
    </td>
    <td className="py-3 pr-4 text-sm text-muted-foreground tabular-nums">
      {clock(player.joinedAt)}
    </td>
    <td className="py-3 text-right text-sm tabular-nums">
      {formatDuration(now - player.joinedAt)}
    </td>
  </tr>
);

const OnlineTable = () => {
  const status = useRuntimeStatus();
  const running = status?.phase === "running";
  const players = status?.players ?? [];
  const count = Math.max(status?.query?.players ?? 0, players.length);
  const now = useNow(15_000, running && players.length > 0);

  return (
    <Section
      title="Online now"
      description={
        running
          ? "Names and Steam IDs come from the server's console as players join."
          : undefined
      }
    >
      {!running ? (
        <ListNotice>
          The world is empty while the server is offline. Players appear here as
          they join.
        </ListNotice>
      ) : count === 0 ? (
        <ListNotice>Nobody is online right now.</ListNotice>
      ) : players.length === 0 ? (
        <ListNotice>
          {count === 1 ? "1 player is" : `${count} players are`} online. The
          server didn't say who.
        </ListNotice>
      ) : (
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border/55 text-left">
              <th className="eyebrow w-[32%] pb-2.5 font-semibold">Player</th>
              <th className="eyebrow w-[28%] pb-2.5 font-semibold">Steam ID</th>
              <th className="eyebrow pb-2.5 font-semibold">Handle</th>
              <th className="eyebrow pb-2.5 font-semibold">Joined</th>
              <th className="eyebrow pb-2.5 text-right font-semibold">
                Online for
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, i) => (
              <OnlineRow
                key={player.handle ?? player.steamId ?? i}
                player={player}
                now={now}
              />
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
};

/** Bans live in the settings file; lifting one saves straight away. */
const useBans = () => {
  const [file, setFile] = useState<SettingsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setFile(await settingsApi().get());
      setError(null);
    } catch (e) {
      setError(toAppError(e).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const lift = async (ban: Ban) => {
    try {
      setFile(
        await settingsApi().save(
          [{ op: "unban", accountIdHash: ban.accountIdHash }],
          false,
        ),
      );
      toast.success(`${ban.displayName || "The player"} is no longer banned`, {
        description: "It takes effect when the server next starts.",
      });
    } catch (e) {
      toast.error("Couldn't lift the ban", {
        description: toAppError(e).message,
      });
    }
  };

  return {
    bans: file?.document ? bansOf(file.document) : [],
    loaded: file !== null,
    error,
    lift,
  };
};

const Bans = () => {
  const { bans, loaded, error, lift } = useBans();
  const running = useServerRuntime((s) => s.status?.phase === "running");

  return (
    <Section
      title="Banned"
      description="Players are banned in game, from the Social tab. Lifting a ban takes effect when the server next starts."
      rule
    >
      {error ? (
        <ListNotice icon={ShieldBanIcon}>
          Couldn't read the bans: {error}
        </ListNotice>
      ) : !loaded ? null : bans.length === 0 ? (
        <ListNotice icon={ShieldBanIcon}>Nobody is banned.</ListNotice>
      ) : (
        <ul className="divide-y divide-border/55 border-y border-border/55">
          {bans.map((ban) => (
            <li
              key={ban.accountIdHash}
              className="flex items-center gap-4 py-3"
            >
              <PlayerAvatar
                name={ban.displayName ?? null}
                seed={ban.accountIdHash}
                className="grayscale"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {ban.displayName || "Unknown player"}
                  {ban.characterName ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      as {ban.characterName}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typeof ban.banDate === "number"
                    ? `Banned on ${format(ban.banDate * 1000, "d MMMM yyyy")}`
                    : "Ban date unknown"}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ShieldOffIcon data-icon="inline-start" />
                    Lift ban
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Lift the ban on {ban.displayName || "this player"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      They can join again once the server
                      {running ? " restarts" : " next starts"}. The settings
                      file is saved straight away.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep the ban</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void lift(ban)}>
                      Lift ban
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

const Players = () => {
  const history = usePlayerHistory();
  const status = useRuntimeStatus();
  const name = useServerRuntime((s) => s.settings?.name ?? null);
  const query = status?.phase === "running" ? status.query : null;
  const online = query
    ? Math.max(query.players, status?.players.length ?? 0)
    : null;
  const dayAgo = Date.now() / 1000 - 86_400;
  const peak = history.reduce(
    (max, s) => (s.at >= dayAgo && s.players > max ? s.players : max),
    online ?? 0,
  );
  const longest = status?.players.reduce(
    (min, p) => (p.joinedAt < min ? p.joinedAt : min),
    Number.POSITIVE_INFINITY,
  );

  return (
    <Page>
      <PageHeader
        eyebrow={name ?? "Enshrouded server"}
        title="Players"
        description="Who's in the world, how busy it has been, and who's banned."
        actions={
          <Button variant="ghost" asChild>
            <Link to="/server-settings" search={{ section: "roles" }}>
              <UsersIcon data-icon="inline-start" />
              Roles and passwords
            </Link>
          </Button>
        }
      />

      <Facts>
        <Fact
          label="Online"
          hint={query ? `of ${query.maxPlayers} slots` : "Server offline"}
        >
          <span className="text-2xl font-semibold">{online ?? "—"}</span>
        </Fact>
        <Fact label="Peak today" hint="In the last 24 hours">
          <span className="text-2xl font-semibold">{peak}</span>
        </Fact>
        <Fact
          label="Longest session"
          hint={
            longest && Number.isFinite(longest)
              ? `Since ${clock(longest)}`
              : "Nobody online"
          }
        >
          <span className="text-2xl font-semibold">
            {longest && Number.isFinite(longest)
              ? formatDuration(Date.now() - longest)
              : "—"}
          </span>
        </Fact>
      </Facts>

      <OnlineTable />
      <PlayerActivity history={history} title="Today" height="h-56" />
      <Bans />
    </Page>
  );
};

export const Route = createFileRoute("/players")({
  component: Players,
});
