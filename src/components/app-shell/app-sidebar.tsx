import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ArchiveIcon,
  FlameIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  ServerIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  TerminalIcon,
  UsersIcon,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Badge, BadgeDot } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useServerRuntime } from "@/hooks/use-server-runtime";
import { phaseView } from "@/lib/server/runtime-display";

type NavItem = {
  title: string;
  to:
    | "/"
    | "/servers"
    | "/server-settings"
    | "/console"
    | "/players"
    | "/backups"
    | "/settings"
    | "/design-system";
  icon: React.ComponentType<{ className?: string }>;
};

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", to: "/", icon: LayoutDashboardIcon },
      { title: "Servers", to: "/servers", icon: ServerIcon },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        title: "Server Settings",
        to: "/server-settings",
        icon: SlidersHorizontalIcon,
      },
      { title: "Console", to: "/console", icon: TerminalIcon },
      { title: "Players", to: "/players", icon: UsersIcon },
      { title: "Backups", to: "/backups", icon: ArchiveIcon },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Settings", to: "/settings", icon: SettingsIcon },
      { title: "Design System", to: "/design-system", icon: PaletteIcon },
    ],
  },
];

/** Server name, state and player count, pinned to the sidebar's foot. */
const ServerSummary = () => {
  const status = useServerRuntime((s) => s.status);
  const name = useServerRuntime((s) => s.settings?.name ?? null);
  const view = phaseView(status);
  const query = status?.phase === "running" ? status.query : null;
  const detail =
    status?.phase === "running" && query
      ? `${view.tone === "success" ? "Flame is lit" : view.label} · ${query.players} / ${query.maxPlayers} online`
      : status?.phase === "starting"
        ? "Lighting the Flame…"
        : status?.phase === "stopping"
          ? "Saving the world…"
          : "Flame is out";

  return (
    <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0">
      <span
        className={cn(
          "relative flex size-6 shrink-0 items-center justify-center rounded-md border bg-linear-160 from-accent to-sidebar",
          view.tone === "neutral"
            ? "border-sidebar-border text-muted-foreground"
            : "border-ember/45 text-ember",
        )}
      >
        <FlameIcon
          className={cn(
            "size-3.5",
            status?.phase === "running" && "animate-flicker",
          )}
        />
      </span>
      <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
        <p className="truncate text-xs font-medium">
          {name ?? "Enshrouded server"}
        </p>
        <p className="truncate text-[0.68rem] text-muted-foreground">
          {detail}
        </p>
      </div>
      <Badge
        variant={view.tone}
        className="group-data-[collapsible=icon]:hidden"
      >
        <BadgeDot />
        {view.label}
      </Badge>
    </div>
  );
};

export const AppSidebar = (props: React.ComponentProps<typeof Sidebar>) => {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const playersOnline = useServerRuntime((s) =>
    s.status?.phase === "running" ? (s.status.query?.players ?? 0) : 0,
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <Link
          to="/"
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <Logo compact={collapsed} />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    item.to === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.to === "/players" && playersOnline > 0 ? (
                        <SidebarMenuBadge>{playersOnline}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <ServerSummary />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
