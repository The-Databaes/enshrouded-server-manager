import { invoke, isTauri } from "@tauri-apps/api/core";

import type { SettingsChange, SettingsDoc } from "@/lib/server/settings-editor";
import { defaultDocument } from "@/lib/server/settings-schema";
import type { SettingsFileState } from "@/lib/server/types";

/** Mirrors `SettingsDocument` in `src-tauri/src/server/settings_file.rs`. */
export type SettingsFile = {
  file: SettingsFileState;
  problem: string | null;
  /** `null` when the file is missing or unreadable. */
  document: SettingsDoc | null;
  path: string;
};

export type SettingsApi = {
  get: () => Promise<SettingsFile>;
  /** With `restart`, a running server is stopped first and started again
   * once the file is written. */
  save: (changes: SettingsChange[], restart: boolean) => Promise<SettingsFile>;
};

const tauriApi: SettingsApi = {
  get: () => invoke("server_settings_get"),
  save: (changes, restart) =>
    invoke("server_settings_save", { changes, restart }),
};

// ---- browser stand-in (`?mockSettings=missing|invalid`) ------------------

const MOCK_PATH =
  "C:\\Users\\you\\.enshrouded-server-manager\\server\\enshrouded_server.json";
let mockDoc: SettingsDoc | null = null;
let mockSeeded = false;

const seedMock = () => {
  if (mockSeeded || typeof window === "undefined") return;
  mockSeeded = true;
  const mode = new URLSearchParams(window.location.search).get("mockSettings");
  if (mode === "missing" || mode === "invalid") return;
  mockDoc = {
    ...defaultDocument(),
    name: "Embervale",
    tags: ["LookingForPlayers", "English"],
    enableTextChat: true,
    bannedAccounts: [
      {
        accountIdHash: "1f3c9a",
        displayName: "TorchThief",
        characterName: "Grimble",
        banDate: Math.floor(Date.now() / 1000) - 3 * 86_400,
      },
    ],
  };
};

const mockFile = (): SettingsFile => {
  const mode =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("mockSettings");
  if (mode === "invalid" && !mockDoc)
    return {
      file: "invalid",
      problem:
        "enshrouded_server.json isn't valid JSON (expected `,` or `}` at line 7 column 3).",
      document: null,
      path: MOCK_PATH,
    };
  return {
    file: mockDoc ? "ok" : "missing",
    problem: null,
    document: mockDoc,
    path: MOCK_PATH,
  };
};

const browserMockApi: SettingsApi = {
  get: async () => {
    seedMock();
    return mockFile();
  },
  save: async (changes) => {
    seedMock();
    await new Promise((r) => setTimeout(r, 400));
    const doc: SettingsDoc = structuredClone(mockDoc ?? {});
    for (const change of changes) {
      if (change.op === "unban") {
        const bans = doc.bannedAccounts;
        if (Array.isArray(bans))
          doc.bannedAccounts = bans.filter(
            (b) => b.accountIdHash !== change.accountIdHash,
          );
        continue;
      }
      let node = doc as Record<string, unknown>;
      for (const key of change.path.slice(0, -1)) {
        node[key] ??= {};
        node = node[key] as Record<string, unknown>;
      }
      node[change.path.at(-1) as string] = change.value;
    }
    mockDoc = doc;
    return mockFile();
  },
};

/** The server's settings file; a simulation outside Tauri. */
export const settingsApi = (): SettingsApi =>
  isTauri() ? tauriApi : browserMockApi;
