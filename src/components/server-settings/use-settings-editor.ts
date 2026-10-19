import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useServerActions, useServerRuntime } from "@/hooks/use-server-runtime";
import { type SettingsFile, settingsApi } from "@/lib/server/settings-api";
import { diffSettings, type SettingsDoc } from "@/lib/server/settings-editor";
import { defaultDocument } from "@/lib/server/settings-schema";
import { toAppError } from "@/lib/steamcmd/api";
import type { AppError } from "@/lib/steamcmd/types";

export type SaveMode = "save" | "restart";

/**
 * The settings file as saved, the user's draft of it, and saving. A file
 * the server hasn't created yet starts as the server's own defaults.
 */
export const useSettingsEditor = () => {
  const [file, setFile] = useState<SettingsFile | null>(null);
  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [draft, setDraft] = useState<SettingsDoc | null>(null);
  const [saving, setSaving] = useState<SaveMode | null>(null);
  const { refreshSettings } = useServerActions();
  const serverRunning = useServerRuntime(
    (s) => s.status?.phase === "running" || s.status?.phase === "starting",
  );

  const adopt = useCallback((next: SettingsFile) => {
    setFile(next);
    setDraft(
      next.document ?? (next.file === "missing" ? defaultDocument() : null),
    );
  }, []);

  const load = useCallback(async () => {
    try {
      adopt(await settingsApi().get());
      setLoadError(null);
    } catch (error) {
      setLoadError(toAppError(error));
    }
  }, [adopt]);

  useEffect(() => {
    void load();
  }, [load]);

  /** What's on disk: an empty document when the file doesn't exist yet. */
  const saved = useMemo<SettingsDoc | null>(
    () => file?.document ?? (file?.file === "missing" ? {} : null),
    [file],
  );
  const changes = useMemo(
    () => (saved && draft ? diffSettings(saved, draft) : []),
    [saved, draft],
  );

  const save = async (mode: SaveMode) => {
    if (!changes.length) return;
    setSaving(mode);
    try {
      const restart = mode === "restart";
      adopt(await settingsApi().save(changes, restart));
      void refreshSettings();
      toast.success(
        restart ? "Saved. The server is restarting." : "Settings saved",
        {
          description: restart
            ? "It saved the world first and is now starting with the new settings."
            : serverRunning
              ? "The server reads them when it next starts. Restart it to apply them now."
              : "The server uses them the next time it starts.",
        },
      );
    } catch (error) {
      toast.error("Couldn't save the settings", {
        description: toAppError(error).message,
      });
    } finally {
      setSaving(null);
    }
  };

  const discard = () => {
    if (file) adopt(file);
  };

  return {
    file,
    loadError,
    saved,
    draft,
    setDraft,
    changes,
    dirty: changes.length > 0,
    saving,
    serverRunning,
    save,
    discard,
    reload: load,
  };
};

export type SettingsEditor = ReturnType<typeof useSettingsEditor>;
