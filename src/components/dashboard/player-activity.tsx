import { cn } from "cn";
import { ActivityIcon } from "lucide-react";
import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Section } from "@/components/layout/page";
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

/** Players online over the last day, as an open chart (no frame). */
export const PlayerActivity = ({
  history,
  title = "Activity",
  className,
  height = "h-60",
}: {
  history: PlayerSample[];
  title?: string;
  className?: string;
  height?: string;
}) => {
  const gradientId = useId();
  const live = useRuntimeStatus()?.phase === "running";
  const data = useMemo(() => {
    const since = Date.now() / 1000 - DAY_SECS;
    return history.filter((s) => s.at >= since);
  }, [history]);
  const peak = data.reduce<PlayerSample | null>(
    (best, s) => (!best || s.players > best.players ? s : best),
    null,
  );
  const top = Math.max(4, peak?.players ?? 0);

  return (
    <Section
      title={title}
      description="Players online over the last 24 hours, sampled every minute while the manager is open."
      className={className}
      actions={
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {peak && peak.players > 0 ? (
            <span>
              Peak{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {peak.players}
              </span>{" "}
              at {hourMinute(peak.at)}
            </span>
          ) : null}
          {live ? (
            <span className="flex items-center gap-1.5 text-shroud">
              <ActivityIcon className="size-3.5" />
              Live
            </span>
          ) : null}
        </div>
      }
    >
      {data.length < 2 ? (
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-xl text-center text-sm text-balance text-muted-foreground",
            height,
          )}
        >
          {/* An empty axis, so the space reads as "a chart, not yet". */}
          <div className="absolute inset-x-0 bottom-8 border-b border-dashed" />
          <div className="absolute inset-x-0 top-1/3 border-b border-dashed border-border/40" />
          <p className="relative max-w-xs bg-background/60 px-3">
            The chart fills in once the server has been online for a couple of
            minutes.
          </p>
        </div>
      ) : (
        <ChartContainer
          config={chartConfig}
          className={cn("aspect-auto w-full", height)}
        >
          <AreaChart data={data} margin={{ left: -24, right: 4, top: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-players)"
                  stopOpacity={0.45}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-players)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="at"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={hourMinute}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={48}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={[0, top]}
              width={40}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--ember)", strokeOpacity: 0.4 }}
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
              activeDot={{
                r: 4,
                strokeWidth: 0,
                fill: "var(--color-players)",
              }}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </Section>
  );
};
