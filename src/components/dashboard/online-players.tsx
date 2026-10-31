import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, UsersIcon } from "lucide-react";

import { Section } from "@/components/layout/page";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { useRuntimeStatus } from "@/hooks/use-server-runtime";
import { formatDuration } from "@/lib/server/runtime-display";
import type { OnlinePlayer } from "@/lib/server/runtime-types";

/** A quiet line in place of a list. */
export const ListNotice = ({
  icon: Icon = UsersIcon,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 border-y border-dashed border-border/70 py-6 text-sm text-muted-foreground">
    <Icon className="size-4 shrink-0 opacity-70" />
    <p className="text-pretty">{children}</p>
  </div>
);

export const PlayerRow = ({
  player,
  now,
  detailed = false,
}: {
  player: OnlinePlayer;
  now: number;
  /** Also show the Steam ID and the server's handle. */
  detailed?: boolean;
}) => (
  <li className="flex items-center gap-4 py-3">
    <PlayerAvatar name={player.name} seed={player.steamId} />
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">
        {player.name ?? (
          <span className="font-normal text-muted-foreground italic">
            Unnamed player
          </span>
        )}
      </p>
      {detailed || player.steamId ? (
        <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
          {player.steamId ?? "No Steam ID shared"}
          {detailed && player.handle ? ` · handle ${player.handle}` : ""}
        </p>
      ) : null}
    </div>
    <div className="text-right">
      <p className="text-sm tabular-nums">
        {formatDuration(now - player.joinedAt)}
      </p>
      <p className="text-[0.7rem] text-muted-foreground">online</p>
    </div>
  </li>
);

/** Who's in the world right now. */
export const OnlinePlayers = () => {
  const status = useRuntimeStatus();
  const running = status?.phase === "running";
  const players = status?.players ?? [];
  // Queries lag a fresh join by a few seconds; the console doesn't.
  const count = Math.max(status?.query?.players ?? 0, players.length);
  const now = useNow(15_000, running && players.length > 0);

  return (
    <Section
      title="Online now"
      description={
        running
          ? `${count} of ${status?.query?.maxPlayers ?? "?"} slots in use`
          : undefined
      }
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/players">
            All players
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      }
    >
      {!running ? (
        <ListNotice>The world is empty while the server is offline.</ListNotice>
      ) : count === 0 ? (
        <ListNotice>
          Nobody is online. Players appear here as they join.
        </ListNotice>
      ) : players.length === 0 ? (
        <ListNotice>
          {count === 1 ? "1 player is" : `${count} players are`} online. The
          server didn't say who.
        </ListNotice>
      ) : (
        <ul className="divide-y divide-border/55 border-y border-border/55">
          {players.map((player, i) => (
            // Without a handle or Steam ID (names from queries only), names
            // needn't be unique; the list keeps a stable order.
            <PlayerRow
              key={player.handle ?? player.steamId ?? i}
              player={player}
              now={now}
            />
          ))}
        </ul>
      )}
    </Section>
  );
};
