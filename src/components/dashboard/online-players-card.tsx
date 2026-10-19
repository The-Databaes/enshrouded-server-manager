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
import { useRuntimeStatus } from "@/hooks/use-server-runtime";
import { formatDuration } from "@/lib/server/runtime-display";

const Notice = ({ children }: { children: React.ReactNode }) => (
  <p className="px-6 py-8 text-center text-sm text-balance text-muted-foreground">
    {children}
  </p>
);

/** Who's connected, as the server reports it to Steam queries. */
export const OnlinePlayersCard = ({ className }: { className?: string }) => {
  const status = useRuntimeStatus();
  const running = status?.phase === "running";
  const count = status?.query?.players ?? 0;
  const players = status?.players ?? [];

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
            server didn't share their names.
          </Notice>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Player</TableHead>
                <TableHead className="pr-6 text-right">Connected for</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player, i) => (
                // Names aren't unique, and the server lists players in a
                // stable order.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                <TableRow key={`${i}-${player.name}`}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-ember/15 text-ember">
                          {player.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{player.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                    {formatDuration(player.connectedSecs * 1000)}
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
