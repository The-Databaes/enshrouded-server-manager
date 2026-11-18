import { useNavigate } from "@tanstack/react-router";
import { Command as CommandPrimitive } from "cmdk";
import {
  ArchiveIcon,
  CircleFadingArrowUpIcon,
  CornerDownLeftIcon,
  DownloadIcon,
  FileCogIcon,
  FolderOpenIcon,
  HardDriveDownloadIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MonitorIcon,
  MoonStarIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SquareIcon,
  SunIcon,
  TerminalIcon,
  UsersIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useServer } from "@/hooks/use-server";
import { useServerActions, useServerRuntime } from "@/hooks/use-server-runtime";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { useUpdateActions, useUpdater } from "@/hooks/use-updater";
import { steamcmdApi } from "@/lib/steamcmd/api";

type Confirmable = "stop" | "restart";

const Item = ({
  icon: Icon,
  label,
  hint,
  keywords,
  onSelect,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  keywords?: string[];
  onSelect: () => void;
  tone?: "ember" | "destructive";
}) => (
  <CommandPrimitive.Item
    value={label}
    keywords={keywords}
    onSelect={onSelect}
    className="group/item flex h-10 cursor-default items-center gap-3 rounded-lg px-3 text-sm outline-none select-none data-[selected=true]:bg-foreground/[0.06] data-[selected=true]:text-foreground"
  >
    <Icon
      className={
        tone === "ember"
          ? "size-4 shrink-0 text-ember"
          : tone === "destructive"
            ? "size-4 shrink-0 text-destructive"
            : "size-4 shrink-0 text-muted-foreground group-data-[selected=true]/item:text-foreground"
      }
    />
    <span className="truncate">{label}</span>
    {hint ? (
      <span className="truncate text-xs text-muted-foreground">{hint}</span>
    ) : null}
    <CornerDownLeftIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 group-data-[selected=true]/item:opacity-100" />
  </CommandPrimitive.Item>
);

const Group = ({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) => (
  <CommandPrimitive.Group
    heading={heading}
    className="px-2 pb-2 **:[[cmdk-group-heading]]:eyebrow **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1.5"
  >
    {children}
  </CommandPrimitive.Group>
);

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Ctrl+K: go anywhere and do the common things without the mouse. */
export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const files = useServer();
  const { task } = useSteamCmd();
  const actions = useServerActions();
  const status = useServerRuntime((s) => s.status);
  const settings = useServerRuntime((s) => s.settings);
  const [confirm, setConfirm] = useState<Confirmable | null>(null);
  const appUpdate = useUpdater((s) => s.update);
  const updating = useUpdater((s) => s.install !== null);
  const updates = useUpdateActions();

  const phase = status?.phase ?? "stopped";
  const players = status?.query?.players ?? 0;
  const installed = files.status?.state === "installed";
  const installDir = files.status?.installDir ?? null;
  const jobRunning = task?.phase === "running";
  const canStart =
    installed && phase === "stopped" && !jobRunning && !status?.externalPid;

  const run = (fn: () => unknown) => () => {
    onOpenChange(false);
    void fn();
  };
  const go = (to: string) => run(() => navigate({ to }));
  const reveal = (path: string) => run(() => steamcmdApi().reveal(path));
  const guarded = (action: Confirmable) =>
    run(() => {
      if (players > 0) setConfirm(action);
      else void actions[action]();
    });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="top-[18%] translate-y-0 gap-0 overflow-hidden border-none p-0 glass sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search and commands</DialogTitle>
          <DialogDescription className="sr-only">
            Go to a page or run a command.
          </DialogDescription>
          <CommandPrimitive loop className="flex flex-col">
            <div className="flex items-center gap-3 border-b px-4">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <CommandPrimitive.Input
                autoFocus
                placeholder="Go to a page, start the server, open a folder…"
                className="h-13 w-full bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
              />
              <Kbd>Esc</Kbd>
            </div>
            <CommandPrimitive.List className="max-h-[min(26rem,60vh)] scroll-py-2 overflow-y-auto py-1">
              <CommandPrimitive.Empty className="py-10 text-center text-sm text-muted-foreground">
                Nothing matches that.
              </CommandPrimitive.Empty>

              {installed ? (
                <Group heading="Server">
                  {canStart ? (
                    <Item
                      icon={PlayIcon}
                      tone="ember"
                      label="Start the server"
                      keywords={["run", "launch", "light"]}
                      onSelect={run(actions.start)}
                    />
                  ) : null}
                  {phase === "running" ? (
                    <>
                      <Item
                        icon={RotateCcwIcon}
                        label="Restart the server"
                        hint={
                          players
                            ? `${players} online, asks first`
                            : "saves first"
                        }
                        onSelect={guarded("restart")}
                      />
                      <Item
                        icon={SquareIcon}
                        tone="destructive"
                        label="Stop the server"
                        hint={
                          players
                            ? `${players} online, asks first`
                            : "saves first"
                        }
                        keywords={["shutdown", "halt"]}
                        onSelect={guarded("stop")}
                      />
                    </>
                  ) : null}
                  {!jobRunning && phase === "stopped" ? (
                    <>
                      {files.status?.updateAvailable ? (
                        <Item
                          icon={DownloadIcon}
                          tone="ember"
                          label="Update the server"
                          hint="a new build is out"
                          onSelect={run(files.update)}
                        />
                      ) : null}
                      <Item
                        icon={RefreshCwIcon}
                        label="Check for server updates"
                        onSelect={run(files.checkUpdate)}
                      />
                      <Item
                        icon={ShieldCheckIcon}
                        label="Verify the server files"
                        keywords={["repair", "validate"]}
                        onSelect={run(files.verify)}
                      />
                    </>
                  ) : null}
                </Group>
              ) : null}

              <Group heading="Go to">
                <Item
                  icon={LayoutDashboardIcon}
                  label="Dashboard"
                  onSelect={go("/")}
                />
                <Item
                  icon={TerminalIcon}
                  label="Console"
                  keywords={["log", "output"]}
                  onSelect={go("/console")}
                />
                <Item
                  icon={UsersIcon}
                  label="Players"
                  keywords={["online", "bans"]}
                  onSelect={go("/players")}
                />
                <Item
                  icon={SlidersHorizontalIcon}
                  label="Server settings"
                  keywords={[
                    "difficulty",
                    "world",
                    "roles",
                    "password",
                    "name",
                  ]}
                  onSelect={go("/server-settings")}
                />
                <Item
                  icon={HardDriveDownloadIcon}
                  label="Server files"
                  keywords={["install", "update", "verify", "build"]}
                  onSelect={go("/servers")}
                />
                <Item
                  icon={ArchiveIcon}
                  label="Backups"
                  keywords={["save", "world"]}
                  onSelect={go("/backups")}
                />
                <Item
                  icon={SettingsIcon}
                  label="App settings"
                  keywords={["steamcmd", "theme"]}
                  onSelect={go("/settings")}
                />
              </Group>

              {installDir ? (
                <Group heading="Open in Explorer">
                  <Item
                    icon={FolderOpenIcon}
                    label="Server folder"
                    onSelect={reveal(`${installDir}\\enshrouded_server.exe`)}
                  />
                  {settings?.file === "ok" ? (
                    <Item
                      icon={FileCogIcon}
                      label="Settings file"
                      hint="enshrouded_server.json"
                      onSelect={reveal(`${installDir}\\enshrouded_server.json`)}
                    />
                  ) : null}
                  {settings && files.status?.lastSavedAt ? (
                    <Item
                      icon={ArchiveIcon}
                      label="Save folder"
                      keywords={["world", "savegame"]}
                      onSelect={reveal(settings.saveDir)}
                    />
                  ) : null}
                  {settings ? (
                    <Item
                      icon={ScrollTextIcon}
                      label="Log folder"
                      onSelect={reveal(settings.logDir)}
                    />
                  ) : null}
                </Group>
              ) : null}

              <Group heading="Manager">
                {appUpdate ? (
                  <Item
                    icon={CircleFadingArrowUpIcon}
                    tone="ember"
                    label={
                      updating
                        ? "Show the update's progress"
                        : `Update the manager to ${appUpdate.version}`
                    }
                    keywords={["update", "upgrade", "new version", "release"]}
                    onSelect={run(updates.openDialog)}
                  />
                ) : null}
                {updating ? null : (
                  <Item
                    icon={RefreshCwIcon}
                    label="Check for manager updates"
                    keywords={["update", "upgrade", "version", "release"]}
                    onSelect={run(() => updates.check({ toasts: true }))}
                  />
                )}
              </Group>

              <Group heading="Appearance">
                <Item
                  icon={MoonStarIcon}
                  label="Dark theme"
                  hint="Shroud"
                  onSelect={run(() => setTheme("dark"))}
                />
                <Item
                  icon={SunIcon}
                  label="Light theme"
                  hint="Embervale"
                  onSelect={run(() => setTheme("light"))}
                />
                <Item
                  icon={MonitorIcon}
                  label="Match Windows"
                  keywords={["system", "theme"]}
                  onSelect={run(() => setTheme("system"))}
                />
              </Group>
            </CommandPrimitive.List>
            <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> to move
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Enter</Kbd> to run
              </span>
            </div>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "stop" ? "Stop the server?" : "Restart the server?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {players === 1 ? "1 player is" : `${players} players are`} online
              and will be disconnected
              {confirm === "restart" ? " while it restarts" : ""}. The world is
              saved first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "stop" ? "destructive" : "default"}
              onClick={() => {
                if (confirm) void actions[confirm]();
                setConfirm(null);
              }}
            >
              {confirm === "stop" ? "Stop server" : "Restart"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
