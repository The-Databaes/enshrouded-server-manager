import { createFileRoute } from "@tanstack/react-router";
import {
  ActivityIcon,
  ArchiveIcon,
  CpuIcon,
  FlameIcon,
  MemoryStickIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, BadgeDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ---- mock data: replaced by real server state later ------------------- */

const playerHistory = [
  { time: "00:00", players: 1 },
  { time: "02:00", players: 0 },
  { time: "04:00", players: 0 },
  { time: "06:00", players: 2 },
  { time: "08:00", players: 4 },
  { time: "10:00", players: 5 },
  { time: "12:00", players: 7 },
  { time: "14:00", players: 6 },
  { time: "16:00", players: 8 },
  { time: "18:00", players: 11 },
  { time: "20:00", players: 9 },
  { time: "22:00", players: 3 },
];

const chartConfig = {
  players: { label: "Players", color: "var(--chart-1)" },
} satisfies ChartConfig;

const onlinePlayers = [
  {
    name: "Thalia",
    level: 25,
    location: "Revelwood",
    ping: 34,
    session: "2h 14m",
  },
  {
    name: "Brannoc",
    level: 21,
    location: "Springlands",
    ping: 58,
    session: "1h 02m",
  },
  {
    name: "Ilyra",
    level: 19,
    location: "Nomad Highlands",
    ping: 112,
    session: "26m",
  },
];

const recentEvents = [
  {
    at: "21:42:08",
    level: "info",
    text: "Thalia placed a Flame Altar in Revelwood",
  },
  { at: "21:40:51", level: "warn", text: "Ilyra ping exceeded 100 ms" },
  {
    at: "21:37:19",
    level: "info",
    text: "Autosave completed (world: Embervale, 412 MB)",
  },
  { at: "21:30:00", level: "info", text: "Scheduled backup #184 completed" },
  {
    at: "21:12:44",
    level: "error",
    text: "Brannoc disconnected: connection timed out",
  },
  { at: "21:13:02", level: "info", text: "Brannoc reconnected" },
  {
    at: "20:58:30",
    level: "info",
    text: "Server started · Enshrouded v0.8.3.1",
  },
];

const LEVEL_STYLES: Record<string, string> = {
  info: "text-info",
  warn: "text-warning",
  error: "text-destructive",
};

/* ---- page ------------------------------------------------------------ */

const StatCard = ({
  title,
  value,
  hint,
  icon: Icon,
  accent = "text-ember",
  children,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  children?: React.ReactNode;
}) => (
  <Card size="sm">
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle className="font-sans text-2xl font-semibold tracking-normal tabular-nums group-data-[size=sm]/card:text-2xl">
        {value}
      </CardTitle>
      <CardAction>
        <span
          className={`flex size-8 items-center justify-center rounded-md border bg-muted ${accent}`}
        >
          <Icon className="size-4" />
        </span>
      </CardAction>
    </CardHeader>
    {hint || children ? (
      <CardContent className="space-y-2">
        {children}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    ) : null}
  </Card>
);

const Dashboard = () => {
  const gradientId = useId();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Embervale · Enshrouded dedicated server"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Restart queued")}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Restart
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                toast.warning("Stop requested", {
                  description: "Players will be warned.",
                })
              }
            >
              <SquareIcon data-icon="inline-start" />
              Stop
            </Button>
            <Button
              size="sm"
              className="shadow-ember"
              onClick={() => toast.success("The Flame is already lit")}
            >
              <PlayIcon data-icon="inline-start" />
              Start
            </Button>
          </>
        }
      />

      {/* stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Server status"
          value="Online"
          icon={FlameIcon}
          hint="Up 2d 14h 06m · v0.8.3.1"
        >
          <Badge variant="success">
            <BadgeDot />
            Flame is lit
          </Badge>
        </StatCard>
        <StatCard
          title="Players online"
          value="3 / 16"
          icon={UsersIcon}
          accent="text-shroud"
          hint="Peak today: 11"
        >
          <Progress value={19} tone="shroud" />
        </StatCard>
        <StatCard
          title="CPU"
          value="42%"
          icon={CpuIcon}
          hint="4 cores allocated"
        >
          <Progress value={42} />
        </StatCard>
        <StatCard
          title="Memory"
          value="6.1 GB"
          icon={MemoryStickIcon}
          hint="of 12 GB reserved"
        >
          <Progress value={51} />
        </StatCard>
      </div>

      {/* chart + events */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Players over the last 24 hours</CardTitle>
            <CardDescription>
              Concurrent players sampled every two hours
            </CardDescription>
            <CardAction>
              <Badge variant="info">
                <ActivityIcon />
                Live
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-56 w-full">
              <AreaChart data={playerHistory} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-players)"
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-players)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="players"
                  type="monotone"
                  stroke="var(--color-players)"
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent events</CardTitle>
            <CardDescription>Tail of the server log</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <ul className="divide-y divide-border/60 font-mono text-xs">
                {recentEvents.map((event) => (
                  <li
                    key={`${event.at}-${event.text}`}
                    className="flex gap-3 px-6 py-2"
                  >
                    <span className="shrink-0 text-muted-foreground">
                      {event.at}
                    </span>
                    <span
                      className={`w-10 shrink-0 uppercase ${LEVEL_STYLES[event.level]}`}
                    >
                      {event.level}
                    </span>
                    <span className="min-w-0 truncate">{event.text}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
          <CardFooter className="border-t">
            <Button variant="link" size="sm" className="px-0">
              Open console
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* players + backups */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Online players</CardTitle>
            <CardDescription>
              Everyone currently exploring Embervale
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm">
                <SwordsIcon data-icon="inline-start" />
                Manage
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Player</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Ping</TableHead>
                  <TableHead className="pr-6 text-right">Session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onlinePlayers.map((player) => (
                  <TableRow key={player.name}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-ember/15 text-ember">
                            {player.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{player.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {player.level}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {player.location}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          player.ping > 100 ? "text-warning" : "text-success"
                        }
                      >
                        {player.ping} ms
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                      {player.session}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Backups</CardTitle>
            <CardDescription>Next scheduled save in 18 minutes</CardDescription>
            <CardAction>
              <Button variant="secondary" size="sm">
                <ArchiveIcon data-icon="inline-start" />
                Back up now
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Storage used</span>
                <span className="tabular-nums">7.4 GB / 20 GB</span>
              </div>
              <Progress value={37} />
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { id: "#184", when: "21:30", size: "412 MB", ok: true },
                { id: "#183", when: "20:30", size: "409 MB", ok: true },
                { id: "#182", when: "19:30", size: "— ", ok: false },
              ].map((backup) => (
                <li
                  key={backup.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${backup.ok ? "bg-success" : "bg-destructive"}`}
                    />
                    <span className="font-medium tabular-nums">
                      {backup.id}
                    </span>
                    <span className="text-muted-foreground">
                      today {backup.when}
                    </span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    {backup.size}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export const Route = createFileRoute("/")({
  component: Dashboard,
});
