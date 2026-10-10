import { Link, useLocation } from "@tanstack/react-router";
import {
  ArchiveIcon,
  FlameIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  ServerIcon,
  SettingsIcon,
  TerminalIcon,
  UsersIcon,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
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

type NavItem = {
  title: string;
  to:
    | "/"
    | "/servers"
    | "/console"
    | "/players"
    | "/backups"
    | "/settings"
    | "/design-system";
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", to: "/", icon: LayoutDashboardIcon },
      { title: "Servers", to: "/servers", icon: ServerIcon, badge: "1" },
    ],
  },
  {
    label: "Manage",
    items: [
      { title: "Console", to: "/console", icon: TerminalIcon },
      { title: "Players", to: "/players", icon: UsersIcon, badge: "3" },
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

export const AppSidebar = (props: React.ComponentProps<typeof Sidebar>) => {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
            <SidebarGroupLabel className="font-display tracking-[0.2em] uppercase">
              {group.label}
            </SidebarGroupLabel>
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
                        className="data-[active=true]:bg-ember-wash data-[active=true]:text-flame data-[active=true]:font-medium"
                      >
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.badge ? (
                        <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
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
        <div className="flex items-center gap-2 rounded-md bg-ember-wash px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-md bg-flame/15 text-flame">
            <FlameIcon className="size-3.5 animate-flicker" />
          </span>
          <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-medium">Embervale</p>
            <p className="truncate text-[0.68rem] text-muted-foreground">
              Flame is lit · 3 online
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-success/40 text-success group-data-[collapsible=icon]:hidden"
          >
            Online
          </Badge>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
