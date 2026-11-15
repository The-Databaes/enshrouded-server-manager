import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell/app-shell";
import { SplashHandoff } from "@/components/app-shell/splash-handoff";
import { WindowFrame } from "@/components/app-shell/window-frame";
import { ServerRuntimeProvider } from "@/components/server/server-runtime-provider";
import { SteamCmdGate } from "@/components/steamcmd/steamcmd-gate";
import { SteamCmdProvider } from "@/components/steamcmd/steamcmd-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import appCss from "../styles.css?url";

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  return (
    // next-themes sets the `dark` class on <html> before hydration, so React
    // must not complain when the server-rendered attribute differs.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
};

const RootComponent = () => {
  return (
    <WindowFrame>
      <SteamCmdProvider>
        <ServerRuntimeProvider>
          <SplashHandoff />
          <SteamCmdGate>
            <AppShell>
              <Outlet />
            </AppShell>
          </SteamCmdGate>
        </ServerRuntimeProvider>
      </SteamCmdProvider>
    </WindowFrame>
  );
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Enshrouded Server Manager" },
      {
        name: "description",
        content: "Manage your Enshrouded dedicated server.",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: light)",
        content: "#f6f1e7",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: dark)",
        content: "#121726",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),

  shellComponent: RootDocument,
  component: RootComponent,
});
