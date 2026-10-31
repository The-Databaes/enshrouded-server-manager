import { useCallback, useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { CommandPalette } from "@/components/app-shell/command-palette";

const RAIL_KEY = "esm-rail-collapsed";

/** Whether the navigation rail is collapsed, remembered between sessions. */
const useRailCollapsed = () => {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem(RAIL_KEY) === "1");
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(RAIL_KEY, c ? "0" : "1");
      return !c;
    });
  }, []);
  return [collapsed, toggle] as const;
};

/** Navigation rail on the left, the page on the right, Ctrl+K anywhere. */
export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, toggleRail] = useRailCollapsed();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (key === "b") {
        e.preventDefault();
        toggleRail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleRail]);

  return (
    // The page scrolls inside #app-viewport (see window-frame.tsx); the rail
    // sticks to the top of it.
    <div className="flex min-h-full">
      <AppSidebar
        collapsed={collapsed}
        onToggle={toggleRail}
        onSearch={() => setPaletteOpen(true)}
      />
      <main className="relative isolate flex min-w-0 flex-1 flex-col">
        {children}
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
};
