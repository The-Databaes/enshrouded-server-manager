import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import {
  FilePlusIcon,
  InfoIcon,
  RotateCcwIcon,
  SaveIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import { PageHeader } from "@/components/app-shell/app-shell";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useServer } from "@/hooks/use-server";
import {
  type SettingsDoc,
  validateSettings,
} from "@/lib/server/settings-editor";
import { steamcmdApi } from "@/lib/steamcmd/api";

const TAB_FIELDS: Record<string, (field: string) => boolean> = {
  general: (f) => !f.startsWith("role:") && f !== "userGroups",
  roles: (f) => f.startsWith("role:") || f === "userGroups",
};

const ServerSettings = () => {
  const files = useServer().status;
  const editor = useSettingsEditor();
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

  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !creating && !saving,
    enableBeforeUnload: () => dirty && !creating,
    withResolver: true,
  });

  if (files && files.state === "notInstalled") {
    return (
      <>
        <PageHeader title="Server Settings" />
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Install the server first</AlertTitle>
          <AlertDescription>
            <p>Its settings live next to the server files.</p>
            <Button size="sm" variant="outline" className="mt-2" asChild>
              <Link to="/servers">Set up the server</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  if (editor.loadError) {
    return (
      <>
        <PageHeader title="Server Settings" />
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Couldn't read the settings</AlertTitle>
          <AlertDescription>
            <p>{editor.loadError.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void editor.reload()}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  if (!file || (file.file !== "invalid" && (!draft || !saved))) {
    return (
      <>
        <PageHeader title="Server Settings" description="Loading…" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  if (file.file === "invalid" || !draft || !saved) {
    return (
      <>
        <PageHeader title="Server Settings" />
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>The settings file can't be read</AlertTitle>
          <AlertDescription>
            <p>{file.problem}</p>
            <p className="mt-1">
              The server won't start like this either. Fix the file in a text
              editor, or delete it to have the server create a fresh one.
            </p>
            <div className="mt-2 flex gap-2">
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
      </>
    );
  }

  const tabErrors = (tab: string) =>
    blocking.filter((p) => TAB_FIELDS[tab]?.(p.field)).length;
  const saveDisabled = !dirty || blocking.length > 0 || saving !== null;
  const primaryLabel = serverRunning
    ? "Save and restart"
    : creating
      ? "Create settings file"
      : "Save";

  const saveButtons = (
    <>
      {dirty && !creating ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={saving !== null}
          onClick={editor.discard}
        >
          Discard
        </Button>
      ) : null}
      {serverRunning ? (
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
            The running server keeps its current settings until it next starts.
          </TooltipContent>
        </Tooltip>
      ) : null}
      <Button
        size="sm"
        className="shadow-ember"
        disabled={saveDisabled}
        onClick={() => void editor.save(serverRunning ? "restart" : "save")}
      >
        {saving === (serverRunning ? "restart" : "save") ? (
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
    </>
  );

  return (
    <>
      <PageHeader
        title="Server Settings"
        description={`${typeof draft.name === "string" && draft.name.trim() ? draft.name : "Your server"} · enshrouded_server.json`}
        actions={saveButtons}
      />

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
      ) : null}
      {serverRunning ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertDescription>
            The server reads these settings only when it starts. Save and
            restart applies them now: the world is saved first, and players are
            disconnected briefly.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="world" className="gap-4">
        <TabsList>
          <TabsTrigger value="general">
            General
            {tabErrors("general") ? (
              <Badge variant="destructive" className="h-4 px-1 text-[0.6rem]">
                {tabErrors("general")}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="world">World and difficulty</TabsTrigger>
          <TabsTrigger value="roles">
            Roles and bans
            {tabErrors("roles") ? (
              <Badge variant="destructive" className="h-4 px-1 text-[0.6rem]">
                {tabErrors("roles")}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="file">File</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralTab draft={draft} problems={problems} onChange={update} />
        </TabsContent>
        <TabsContent value="world">
          <WorldTab saved={saved} draft={draft} onChange={update} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab draft={draft} problems={problems} onChange={update} />
        </TabsContent>
        <TabsContent value="file">
          <FileTab file={file} draft={draft} changes={changes} />
        </TabsContent>
      </Tabs>

      {dirty && !creating ? (
        <div className="sticky bottom-4 z-10 mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-ember/40 bg-popover/95 px-4 py-2.5 shadow-stone backdrop-blur">
          <p className="text-sm">
            {blocking.length ? (
              <span className="text-destructive">
                {blocking.length === 1
                  ? blocking[0].message
                  : `${blocking.length} problems to fix before saving.`}
              </span>
            ) : (
              <>
                <span className="font-semibold tabular-nums">
                  {changes.length}
                </span>{" "}
                unsaved {changes.length === 1 ? "change" : "changes"}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">{saveButtons}</div>
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
    </>
  );
};

export const Route = createFileRoute("/server-settings")({
  component: ServerSettings,
});
