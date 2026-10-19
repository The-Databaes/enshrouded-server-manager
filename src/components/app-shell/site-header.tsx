import { Link, useLocation } from "@tanstack/react-router";
import { BellIcon, SearchIcon } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useServerRuntime } from "@/hooks/use-server-runtime";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/servers": "Servers",
  "/server-settings": "Server Settings",
  "/console": "Console",
  "/players": "Players",
  "/backups": "Backups",
  "/settings": "Settings",
  "/design-system": "Design System",
};

export const SiteHeader = () => {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "Enshrouded";
  const serverName = useServerRuntime((s) => s.settings?.name ?? null);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink asChild>
              <Link to="/">{serverName ?? "Enshrouded"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative hidden md:block">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search players, saves, logs…"
            className="h-8 w-64 pl-8 pr-12"
            aria-label="Search"
          />
          <Kbd className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2">
            ⌘K
          </Kbd>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative"
        >
          <BellIcon className="size-4" />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-ember shadow-ember" />
        </Button>
        <ModeToggle />
      </div>
    </header>
  );
};
