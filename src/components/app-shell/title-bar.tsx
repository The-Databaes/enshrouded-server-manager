import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "cn";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/brand/logo";

/** Tracks maximised/focused state of the native window (no-op in a browser). */
const useWindowState = () => {
  const [maximized, setMaximized] = useState(false);
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    let disposed = false;
    const unlisten: (() => void)[] = [];
    const keep = (fn: () => void) => {
      if (disposed) fn();
      else unlisten.push(fn);
    };
    const syncMaximized = () =>
      win.isMaximized().then((m) => {
        if (!disposed) setMaximized(m);
      });

    void syncMaximized();
    void win.onResized(() => void syncMaximized()).then(keep);
    void win.onFocusChanged(({ payload }) => setFocused(payload)).then(keep);

    return () => {
      disposed = true;
      for (const fn of unlisten) fn();
    };
  }, []);

  return { maximized, focused };
};

const withWindow =
  (action: (win: ReturnType<typeof getCurrentWindow>) => Promise<void>) =>
  () => {
    if (isTauri()) void action(getCurrentWindow());
  };

/* Glyphs drawn to match the 10px Segoe Fluent caption icons Windows uses. */
const Glyph = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 10 10"
    className="size-2.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const CaptionButton = ({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={cn(
      "inline-flex h-full w-[46px] items-center justify-center text-foreground/80 transition-colors outline-none focus-visible:bg-foreground/10",
      danger
        ? "hover:bg-[#c42b1c] hover:text-white active:bg-[#c42b1c]/85"
        : "hover:bg-foreground/10 active:bg-foreground/15",
    )}
  >
    {children}
  </button>
);

/**
 * Custom window title bar (the native frame is turned off with
 * `decorations: false` in tauri.conf.json). The whole bar drags the window and
 * double-clicking it toggles maximise, like a native title bar.
 */
export const TitleBar = () => {
  const { maximized, focused } = useWindowState();

  return (
    <header
      data-tauri-drag-region="deep"
      className="relative z-60 flex h-(--titlebar-height) shrink-0 items-center border-b border-sidebar-border bg-sidebar text-sidebar-foreground select-none"
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 px-3 transition-opacity",
          !focused && "opacity-50",
        )}
      >
        <LogoMark tile className="size-4 rounded-[4px]" aria-hidden="true" />
        <span className="truncate text-xs text-muted-foreground">
          Enshrouded Server Manager
        </span>
      </div>

      <div className="flex h-full shrink-0">
        <CaptionButton
          label="Minimize"
          onClick={withWindow((w) => w.minimize())}
        >
          <Glyph>
            <path d="M0 5.5h10" />
          </Glyph>
        </CaptionButton>
        <CaptionButton
          label={maximized ? "Restore" : "Maximize"}
          onClick={withWindow((w) => w.toggleMaximize())}
        >
          <Glyph>
            {maximized ? (
              <>
                <rect x="0.5" y="2.5" width="7" height="7" />
                <path d="M2.5 2.5v-2h7v7h-2" />
              </>
            ) : (
              <rect x="0.5" y="0.5" width="9" height="9" />
            )}
          </Glyph>
        </CaptionButton>
        <CaptionButton
          label="Close"
          danger
          onClick={withWindow((w) => w.close())}
        >
          <Glyph>
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" shapeRendering="auto" />
          </Glyph>
        </CaptionButton>
      </div>
    </header>
  );
};
