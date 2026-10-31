import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNow } from "@/hooks/use-now";
import { useRuntimeStatus } from "@/hooks/use-server-runtime";
import { formatDuration } from "@/lib/server/runtime-display";

const Notice = ({ children }: { children: React.ReactNode }) => (
  <p className="px-6 py-8 text-center text-sm text-balance text-muted-foreground">
    {children}
  </p>
);

const Unknown = () => <span className="text-muted-foreground">—</span>;

/** Who's connected, as the server's console (or its Steam queries) tells it. */
export const OnlinePlayersCard = ({ className }: { className?: string }) => {
  const status = useRuntimeStatus();
  const running = status?.phase === "running";
  const players = status?.players ?? [];
  // Queries lag a fresh join by a few seconds; the console doesn't.
  const count = Math.max(status?.query?.players ?? 0, players.length);
  const now = useNow(15_000, running && players.length > 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Online players</CardTitle>
        <CardDescription>
          {running
            ? `${count} of ${status?.query?.maxPlayers ?? "?"} slots in use`
            : "Everyone currently in the world"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {!running ? (
          <Notice>The server is offline.</Notice>
        ) : count === 0 ? (
          <Notice>Nobody is online right now.</Notice>
        ) : players.length === 0 ? (
          <Notice>
            {count === 1 ? "1 player is" : `${count} players are`} online. The
            server didn't share who.
          </Notice>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Player</TableHead>
                <TableHead>Steam ID</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead className="pr-6 text-right">Connected for</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player, i) => (
                // Without a handle or Steam ID (names from queries only),
                // names needn't be unique; the list keeps a stable order.
                <TableRow key={player.handle ?? player.steamId ?? i}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-ember/15 text-ember">
                          {player.name?.charAt(0).toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      {player.name ? (
                        <span className="font-medium">{player.name}</span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          Unnamed player
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {player.steamId ?? <Unknown />}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {player.handle ?? <Unknown />}
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                    {formatDuration(now - player.joinedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
