import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ArchiveIcon,
  HardDriveDownloadIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MoonStarIcon,
  PaletteIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SunIcon,
  TerminalIcon,
  UsersIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { FlameBeacon } from "@/components/brand/flame-beacon";
import { StatusDot } from "@/components/status-dot";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { beaconState } from "@/lib/server/beacon";
import { phaseView } from "@/lib/server/runtime-display";
import {
  isServerTask,
  progressFigures,
  TASK_TITLES,
} from "@/lib/steamcmd/task";

type To =
  | "/"
  | "/servers"
  | "/server-settings"
  | "/console"
  | "/players"
  | "/backups"
  | "/settings"
  | "/design-system";

type NavItem = { title: string; to: To; icon: LucideIcon };

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Server",
    items: [
      { title: "Dashboard", to: "/", icon: LayoutDashboardIcon },
      { title: "Console", to: "/console", icon: TerminalIcon },
      { title: "Players", to: "/players", icon: UsersIcon },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        title: "Server settings",
        to: "/server-settings",
        icon: SlidersHorizontalIcon,
      },
      { title: "Server files", to: "/servers", icon: HardDriveDownloadIcon },
      { title: "Backups", to: "/backups", icon: ArchiveIcon },
    ],
  },
];

const FOOTER_NAV: NavItem[] = [
  { title: "App settings", to: "/settings", icon: SettingsIcon },
  ...(import.meta.env.DEV
    ? [
        {
          title: "Design system",
          to: "/design-system" as const,
          icon: PaletteIcon,
        },
      ]
    : []),
];

/** Shows its label as a tooltip when the rail is collapsed. */
const RailTip = ({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: React.ReactNode;
  children: React.ReactElement;
}) =>
  collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  ) : (
    children
  );

const NavLink = ({
  item,
  active,
  collapsed,
  badge,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: React.ReactNode;
}) => (
  <RailTip collapsed={collapsed} label={item.title}>
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[0.9rem] font-medium text-sidebar-foreground/80 transition-colors outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
        active &&
          "bg-[linear-gradient(to_right,color-mix(in_oklch,var(--ember)_15%,transparent),color-mix(in_oklch,var(--ember)_3%,transparent))] text-foreground hover:bg-[linear-gradient(to_right,color-mix(in_oklch,var(--ember)_18%,transparent),color-mix(in_oklch,var(--ember)_5%,transparent))]",
        collapsed && "justify-center px-0",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-ember shadow-[0_0_10px_var(--ember)]"
        />
      ) : null}
      <item.icon
        className={cn(
          "size-[1.05rem] shrink-0 transition-colors",
          active
            ? "text-ember"
            : "text-muted-foreground group-hover/nav:text-foreground",
        )}
      />
      {collapsed ? null : <span className="truncate">{item.title}</span>}
      {badge ? (
        <span
          className={cn(
            collapsed ? "absolute top-1 right-1.5" : "ml-auto",
            "flex items-center",
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  </RailTip>
);

/** The server at a glance: its flame, name and state. Leads to the dashboard. */
const ServerBeacon = ({ collapsed }: { collapsed: boolean }) => {
  const status = useServerRuntime((s) => s.status);
  const name = useServerRuntime((s) => s.settings?.name ?? null);
  const view = phaseView(status);
  const query = status?.phase === "running" ? status.query : null;
  const detail = query
    ? `${view.label} · ${query.players} / ${query.maxPlayers}`
    : view.label;

  return (
    <RailTip
      collapsed={collapsed}
      label={`${name ?? "Enshrouded server"} · ${detail}`}
    >
      <Link
        to="/"
        className={cn(
          "flex items-center gap-3 rounded-xl p-2 transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring/60",
          collapsed && "justify-center p-1",
        )}
      >
        <FlameBeacon state={beaconState(status)} size="sm" />
        {collapsed ? null : (
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[0.95rem] leading-tight font-semibold tracking-[0.05em]">
              {name ?? "Enshrouded server"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <StatusDot
                tone={view.tone}
                pulse={
                  status?.phase === "starting" || status?.phase === "stopping"
                }
                className="size-1.5"
              />
              <span className="truncate tabular-nums">{detail}</span>
            </p>
          </div>
        )}
      </Link>
    </RailTip>
  );
};

/** A SteamCMD job in progress, visible from every page. */
const JobIndicator = ({ collapsed }: { collapsed: boolean }) => {
  const { task } = useSteamCmd();
  if (task?.phase !== "running") return null;
  const { percent } = progressFigures(task);
  const to = isServerTask(task.kind) ? "/servers" : "/settings";
  const title = TASK_TITLES[task.kind].running;

  return (
    <RailTip
      collapsed={collapsed}
      label={`${title}${percent === null ? "" : ` ${Math.floor(percent)}%`}`}
    >
      <Link
        to={to}
        className={cn(
          "block rounded-lg border border-ember/25 bg-ember/[0.07] px-3 py-2.5 transition-colors outline-none hover:border-ember/45 focus-visible:ring-2 focus-visible:ring-ring/60",
          collapsed && "px-2",
        )}
      >
        {collapsed ? null : (
          <p className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">{title}</span>
            {percent === null ? null : (
              <span className="text-ember tabular-nums">
                {Math.floor(percent)}%
              </span>
            )}
          </p>
        )}
        <Progress
          value={percent ?? 100}
          className={cn("h-1", percent === null && "animate-pulse opacity-60")}
          aria-label={title}
        />
      </Link>
    </RailTip>
  );
};

const RailButton = ({
  label,
  collapsed,
  onClick,
  children,
  shortcut,
}: {
  label: string;
  collapsed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  shortcut?: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 [&_svg]:size-4"
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent side={collapsed ? "right" : "top"}>
      {label}
      {shortcut ? <Kbd className="ml-2">{shortcut}</Kbd> : null}
    </TooltipContent>
  </Tooltip>
);

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onSearch: () => void;
};

export const AppSidebar = ({
  collapsed,
  onToggle,
  onSearch,
}: AppSidebarProps) => {
  const { pathname } = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const players = useServerRuntime((s) =>
    s.status?.phase === "running"
      ? Math.max(s.status.query?.players ?? 0, s.status.players.length)
      : 0,
  );
  const isActive = (to: To) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "sidebar-mist sticky top-0 z-30 flex h-(--page-height) shrink-0 flex-col border-r border-sidebar-border bg-sidebar/85 text-sidebar-foreground backdrop-blur-sm transition-[width] duration-200 ease-out",
        collapsed ? "w-(--rail-width-collapsed)" : "w-(--rail-width)",
      )}
    >
      <div className={cn("p-3 pb-2", collapsed && "px-2")}>
        <ServerBeacon collapsed={collapsed} />
      </div>

      <div className={cn("px-3", collapsed && "px-2")}>
        {collapsed ? (
          <RailButton
            label="Search and commands"
            shortcut="Ctrl K"
            collapsed
            onClick={onSearch}
          >
            <SearchIcon />
          </RailButton>
        ) : (
          <button
            type="button"
            onClick={onSearch}
            className="flex h-8.5 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-background/40 px-2.5 text-[0.82rem] text-muted-foreground transition-colors outline-none hover:border-shroud/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <SearchIcon className="size-3.5" />
            Search or run…
            <Kbd className="ml-auto">Ctrl K</Kbd>
          </button>
        )}
      </div>

      <nav
        aria-label="Main"
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pt-6",
          collapsed && "items-stretch px-2",
        )}
      >
        {NAV.map((group) => (
          <div key={group.label} className="space-y-1">
            {collapsed ? (
              <div className="hairline mx-2 mb-2" />
            ) : (
              <p className="eyebrow px-2.5 pb-1.5 text-[0.62rem]">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                active={isActive(item.to)}
                badge={
                  item.to !== "/players" ||
                  players === 0 ? undefined : collapsed ? (
                    <span className="size-1.5 rounded-full bg-shroud shadow-[0_0_6px_var(--shroud)]" />
                  ) : (
                    <span className="rounded-full bg-shroud/20 px-1.5 text-[0.68rem] leading-4.5 font-semibold text-shroud tabular-nums">
                      {players}
                    </span>
                  )
                }
              />
            ))}
          </div>
        ))}
      </nav>

      <div className={cn("space-y-2 p-3", collapsed && "px-2")}>
        <JobIndicator collapsed={collapsed} />
        <div className="space-y-1">
          {FOOTER_NAV.map((item) => (
            <NavLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              active={isActive(item.to)}
            />
          ))}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 border-t border-sidebar-border pt-2",
            collapsed && "flex-col",
          )}
        >
          <RailButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            shortcut="Ctrl B"
            collapsed={collapsed}
            onClick={onToggle}
          >
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </RailButton>
          <RailButton
            label={
              resolvedTheme === "dark"
                ? "Switch to the light theme"
                : "Switch to the dark theme"
            }
            collapsed={collapsed}
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? <SunIcon /> : <MoonStarIcon />}
          </RailButton>
          {collapsed ? null : (
            <span className="ml-auto pr-1 text-[0.68rem] text-muted-foreground/70">
              Server Manager
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
