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
        <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0">
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-md border border-ember/45 bg-linear-160 from-accent to-sidebar text-ember">
            <FlameIcon className="size-3.5 animate-flicker" />
          </span>
          <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-medium">Embervale</p>
            <p className="truncate text-[0.68rem] text-muted-foreground">
              Flame is lit · 3 online
            </p>
          </div>
          <Badge
            variant="success"
            className="group-data-[collapsible=icon]:hidden"
          >
            <BadgeDot />
            Online
          </Badge>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
