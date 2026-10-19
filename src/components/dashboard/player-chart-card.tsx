import { ActivityIcon } from "lucide-react";
import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useRuntimeStatus } from "@/hooks/use-server-runtime";
import type { PlayerSample } from "@/lib/server/runtime-types";

const chartConfig = {
  players: { label: "Players", color: "var(--chart-1)" },
} satisfies ChartConfig;

const DAY_SECS = 86_400;

const hourMinute = (secs: number) =>
  new Date(secs * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Players online over the last 24 hours. */
export const PlayerChartCard = ({
  history,
  className,
}: {
  history: PlayerSample[];
  className?: string;
}) => {
  const gradientId = useId();
  const live = useRuntimeStatus()?.phase === "running";
  const data = useMemo(() => {
    const since = Date.now() / 1000 - DAY_SECS;
    return history.filter((s) => s.at >= since);
  }, [history]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Players over the last 24 hours</CardTitle>
        <CardDescription>
          Sampled every minute while the manager is open
        </CardDescription>
        {live ? (
          <CardAction>
            <Badge variant="info">
              <ActivityIcon />
              Live
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      {/* Fills the row, which the console card beside it sets the height of. */}
      <CardContent className="flex flex-1 flex-col">
        {data.length < 2 ? (
          <div className="flex min-h-56 flex-1 items-center justify-center rounded-lg border border-dashed text-center text-sm text-balance text-muted-foreground">
            The chart fills in once the server has been online for a couple of
            minutes.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto min-h-56 w-full flex-1"
          >
            <AreaChart data={data} margin={{ left: -20, right: 8 }}>
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
                dataKey="at"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={hourMinute}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_, payload) => {
                      const at = payload?.[0]?.payload?.at;
                      return typeof at === "number" ? hourMinute(at) : "";
                    }}
                  />
                }
              />
              <Area
                dataKey="players"
                type="stepAfter"
                stroke="var(--color-players)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
