import {
  createFileRoute,
  Link,
  useBlocker,
  useNavigate,
} from "@tanstack/react-router";
import { cn } from "cn";
import {
  FileCodeIcon,
  FilePlusIcon,
  GlobeIcon,
  InfoIcon,
  type LucideIcon,
  MountainSnowIcon,
  RotateCcwIcon,
  SaveIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";

import { Page, PageHeader } from "@/components/layout/page";
import { FileTab } from "@/components/server-settings/file-tab";
import { GeneralTab } from "@/components/server-settings/general-tab";
import { RolesTab } from "@/components/server-settings/roles-tab";
import { useSettingsEditor } from "@/components/server-settings/use-settings-editor";
import { WorldTab } from "@/components/server-settings/world-tab";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useServer } from "@/hooks/use-server";
import {
  type SettingsChange,
  type SettingsDoc,
  validateSettings,
} from "@/lib/server/settings-editor";
import { steamcmdApi } from "@/lib/steamcmd/api";

const SECTIONS = ["general", "world", "roles", "file"] as const;
type SectionId = (typeof SECTIONS)[number];

const SECTION_INFO: Record<
  SectionId,
  { label: string; hint: string; icon: LucideIcon }
> = {
  general: {
    label: "General",
    hint: "Name, slots, chat",
    icon: GlobeIcon,
  },
  world: {
    label: "World",
    hint: "Difficulty and rules",
    icon: MountainSnowIcon,
  },
  roles: {
    label: "Roles and bans",
    hint: "Passwords, permissions",
    icon: UsersRoundIcon,
  },
  file: { label: "File", hint: "What gets saved", icon: FileCodeIcon },
};

/** Which section a problem's field belongs to. */
const problemSection = (field: string): SectionId =>
  field.startsWith("role:") || field === "userGroups" ? "roles" : "general";

/** Which section a change belongs to. */
const changeSection = (change: SettingsChange): SectionId => {
  if (change.op === "unban") return "roles";
  const [key] = change.path;
  if (key === "gameSettings" || key === "gameSettingsPreset") return "world";
  if (key === "userGroups" || key === "bannedAccounts" || key === "bans")
    return "roles";
  return "general";
};

const SettingsSkeleton = () => (
  <div
    className="grid gap-14 2xl:grid-cols-[12.5rem_minmax(0,1fr)]"
    aria-busy="true"
  >
    <div className="space-y-2">
      {SECTIONS.map((s) => (
        <Skeleton key={s} className="h-12 w-full" />
      ))}
    </div>
    <div className="space-y-6">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  </div>
);

const ServerSettings = () => {
  const files = useServer().status;
  const editor = useSettingsEditor();
  const { section = "general" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSection = useCallback(
    (next: SectionId) =>
      void navigate({ search: { section: next }, replace: true }),
    [navigate],
  );
  const { file, draft, saved, changes, dirty, saving, serverRunning } = editor;
  const { setDraft } = editor;
  const update = useCallback(
    (change: (doc: SettingsDoc) => SettingsDoc) =>
      setDraft((doc) => (doc ? change(doc) : doc)),
    [setDraft],
  );
  const problems = useMemo(
    () => (draft ? validateSettings(draft) : []),
    [draft],
  );
  const blocking = problems.filter((p) => p.blocking);
  const creating = file?.file === "missing";
  const saveDisabled = !dirty || blocking.length > 0 || saving !== null;
  const primaryMode = serverRunning ? "restart" : "save";

  const blocker = useBlocker({
    // Switching sections only changes the search; only leaving the page
    // would lose the draft.
    shouldBlockFn: ({ current, next }) =>
      current.pathname !== next.pathname && dirty && !creating && !saving,
    enableBeforeUnload: () => dirty && !creating,
    withResolver: true,
  });

  // Ctrl+S saves, like everywhere else.
  const { save } = editor;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saveDisabled) void save(primaryMode);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveDisabled, save, primaryMode]);

  const name =
    draft && typeof draft.name === "string" && draft.name.trim()
      ? draft.name
      : (files?.settings?.name ?? "Your server");

  const header = (
    <PageHeader
      eyebrow={
        <>
          {name}
          <span className="text-muted-foreground/50">·</span>
          <span className="normal-case tracking-normal">
            enshrouded_server.json
          </span>
        </>
      }
      title="Server settings"
      description="What the server reads when it starts: how it's listed, how hard the world is, and who may join."
    />
  );

  if (files && files.state === "notInstalled") {
    return (
      <Page>
        {header}
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Install the server first</AlertTitle>
          <AlertDescription>
            <p>Its settings live next to the server's files.</p>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link to="/servers">Set up the server</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </Page>
    );
  }

  if (editor.loadError) {
    return (
      <Page>
        {header}
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Couldn't read the settings</AlertTitle>
          <AlertDescription>
            <p>{editor.loadError.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => void editor.reload()}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </Page>
    );
  }

  if (!file || (file.file !== "invalid" && (!draft || !saved))) {
    return (
      <Page width="wide">
        {header}
        <SettingsSkeleton />
      </Page>
    );
  }

  if (file.file === "invalid" || !draft || !saved) {
    return (
      <Page>
        {header}
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>The settings file can't be read</AlertTitle>
          <AlertDescription>
            <p>{file.problem}</p>
            <p>
              The server won't start like this either. Fix the file in a text
              editor, or delete it to have the server create a fresh one.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void steamcmdApi().reveal(file.path)}
              >
                Show file
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void editor.reload()}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Check again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </Page>
    );
  }

  const errorsIn = (id: SectionId) =>
    blocking.filter((p) => problemSection(p.field) === id).length;
  const changesIn = (id: SectionId) =>
    id === "file"
      ? changes.length
      : changes.filter((c) => changeSection(c) === id).length;

  // A file that doesn't exist yet has nothing to compare with: mark no
  // setting as changed.
  const baseline = creating ? draft : saved;

  const primaryLabel = creating
    ? "Create settings file"
    : serverRunning
      ? "Save and restart"
      : "Save";

  return (
    <Page width="wide">
      {header}

      {creating ? (
        <Alert variant="info">
          <FilePlusIcon />
          <AlertTitle>The server hasn't created its settings yet</AlertTitle>
          <AlertDescription>
            These are the defaults it would start with, including roles with
            random passwords. Change what you like and create the file, or just
            start the server and it creates the same file itself.
          </AlertDescription>
        </Alert>
      ) : serverRunning ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertDescription>
            The server reads these settings only when it starts. Save and
            restart applies them now: the world is saved first, and players are
            disconnected briefly.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-x-12 gap-y-8 xl:grid-cols-[13rem_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-x-auto border-b border-border/55 pb-2 xl:sticky xl:top-8 xl:flex-col xl:self-start xl:border-b-0 xl:pb-0"
        >
          {SECTIONS.map((id) => {
            const info = SECTION_INFO[id];
            const active = id === section;
            const errors = errorsIn(id);
            const edits = changesIn(id);
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setSection(id)}
                className={cn(
                  "group relative flex min-w-44 items-center gap-3 rounded-lg px-3 py-2.5 xl:min-w-0 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "bg-foreground/[0.055] text-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-ember shadow-[0_0_8px_var(--ember)] xl:inset-x-auto xl:top-3 xl:bottom-3 xl:left-0 xl:h-auto xl:w-0.5"
                  />
                ) : null}
                <info.icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-ember" : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {info.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {info.hint}
                  </span>
                </span>
                {errors ? (
                  <span className="rounded-full bg-destructive/15 px-1.5 text-xs leading-5 font-semibold text-destructive tabular-nums">
                    {errors}
                  </span>
                ) : edits && !creating ? (
                  <span className="rounded-full bg-ember/15 px-1.5 text-xs leading-5 font-semibold text-ember tabular-nums">
                    {edits}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div key={section} className="min-w-0 animate-page-in">
          {section === "general" ? (
            <GeneralTab
              draft={draft}
              saved={baseline}
              problems={problems}
              onChange={update}
            />
          ) : section === "world" ? (
            <WorldTab saved={baseline} draft={draft} onChange={update} />
          ) : section === "roles" ? (
            <RolesTab draft={draft} problems={problems} onChange={update} />
          ) : (
            <FileTab file={file} draft={draft} changes={changes} />
          )}
        </div>
      </div>

      {dirty ? (
        <div className="pointer-events-none sticky bottom-6 z-20 -mt-4 flex justify-center">
          <div className="pointer-events-auto flex animate-rise-in flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl py-2 pr-2 pl-5 glass">
            <p className="text-sm">
              {blocking.length ? (
                <button
                  type="button"
                  className="flex items-center gap-2 text-destructive hover:underline"
                  onClick={() => setSection(problemSection(blocking[0].field))}
                >
                  <TriangleAlertIcon className="size-4" />
                  {blocking.length === 1
                    ? blocking[0].message
                    : `${blocking.length} problems to fix before saving`}
                </button>
              ) : creating ? (
                <span className="text-muted-foreground">
                  Not created yet. The server would use these defaults.
                </span>
              ) : (
                <span className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-ember shadow-[0_0_8px_var(--ember)]" />
                  <span>
                    <span className="font-semibold tabular-nums">
                      {changes.length}
                    </span>{" "}
                    unsaved {changes.length === 1 ? "change" : "changes"}
                  </span>
                </span>
              )}
            </p>
            <div className="flex items-center gap-1.5">
              {section !== "file" && !creating ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSection("file")}
                >
                  Review
                </Button>
              ) : null}
              {!creating ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving !== null}
                  onClick={editor.discard}
                >
                  Discard
                </Button>
              ) : null}
              {serverRunning && !creating ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saveDisabled}
                      onClick={() => void editor.save("save")}
                    >
                      {saving === "save" ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <SaveIcon data-icon="inline-start" />
                      )}
                      Save only
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    The running server keeps its current settings until it next
                    starts.
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    disabled={saveDisabled}
                    onClick={() => void editor.save(primaryMode)}
                  >
                    {saving === primaryMode ? (
                      <Spinner data-icon="inline-start" />
                    ) : creating ? (
                      <FilePlusIcon data-icon="inline-start" />
                    ) : serverRunning ? (
                      <RotateCcwIcon data-icon="inline-start" />
                    ) : (
                      <SaveIcon data-icon="inline-start" />
                    )}
                    {primaryLabel}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <Kbd>Ctrl S</Kbd>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {changes.length} unsaved{" "}
              {changes.length === 1 ? "change" : "changes"} to the server's
              settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => blocker.status === "blocked" && blocker.proceed()}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
};

export const Route = createFileRoute("/server-settings")({
  validateSearch: (search: Record<string, unknown>): { section?: SectionId } =>
    SECTIONS.includes(search.section as SectionId)
      ? { section: search.section as SectionId }
      : {},
  component: ServerSettings,
});
