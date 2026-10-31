import { describe, expect, it } from "vitest";

import {
  bansOf,
  diffSettings,
  removeBan,
  type SettingsDoc,
  setPreset,
  setWorldValue,
  worldValue,
} from "@/lib/server/settings-editor";
import {
  defaultDocument,
  defaultGameSettings,
  NS_PER_MINUTE,
  presetValue,
  WORLD_SETTINGS,
  WORLD_SETTINGS_BY_KEY,
  type WorldSetting,
} from "@/lib/server/settings-schema";

const setting = (key: string) => WORLD_SETTINGS_BY_KEY.get(key) as WorldSetting;

/** What the current server build writes on first start (trimmed). */
const serverFile = (): SettingsDoc => ({
  name: "Embervale",
  gameSettingsPreset: "Relaxed",
  gameSettings: { ...defaultGameSettings(), aNewerSetting: 7 },
  userGroups: [],
  bannedAccounts: [
    { accountIdHash: "a", displayName: "Grief", banDate: 1 },
    { accountIdHash: "b" },
  ],
});

describe("schema", () => {
  it("covers all 38 world settings with defaults inside their ranges", () => {
    expect(WORLD_SETTINGS).toHaveLength(38);
    expect(Object.keys(defaultGameSettings())).toHaveLength(38);
    for (const s of WORLD_SETTINGS) {
      if (s.kind === "factor" || s.kind === "duration" || s.kind === "level") {
        expect(s.default).toBeGreaterThanOrEqual(s.min);
        expect(s.default).toBeLessThanOrEqual(s.max);
      }
      if (s.kind === "choice") {
        expect(s.options.map((o) => o.value)).toContain(s.default);
      }
    }
    expect(defaultGameSettings().dayTimeDuration).toBe(30 * NS_PER_MINUTE);
  });

  it("matches what server 1.0 writes into a new file", () => {
    const keys = Object.keys(defaultGameSettings());
    expect(keys.at(-1)).toBe("flameLevelFogRemoval");
    expect(defaultGameSettings()).toMatchObject({
      randomSpawnerAmount: "Automatic",
      aggroPoolAmount: "Normal",
      flameLevelFogRemoval: 11,
    });
  });

  it("starts a new file with the four roles and unique passwords", () => {
    const doc = defaultDocument();
    const roles = doc.userGroups as { name: string; password: string }[];
    expect(roles.map((r) => r.name)).toEqual([
      "Admin",
      "Friend",
      "Guest",
      "Visitor",
    ]);
    expect(new Set(roles.map((r) => r.password)).size).toBe(4);
  });
});

describe("presets", () => {
  it("plays the preset's values, not the file's, unless Custom", () => {
    const doc = serverFile();
    expect(worldValue(doc, setting("playerHealthFactor"))).toEqual({
      value: 2,
      source: "preset",
    });
    const custom = { ...doc, gameSettingsPreset: "Custom" };
    expect(worldValue(custom, setting("playerHealthFactor")).value).toBe(1);
    expect(worldValue(custom, setting("nightTimeDuration")).value).toBe(12);
  });

  it("plays the values server 1.0 logs for each preset", () => {
    expect(presetValue("Default", setting("randomSpawnerAmount"))).toBe(
      "Automatic",
    );
    expect(presetValue("Hard", setting("enemyDamageFactor"))).toBe(1.25);
    expect(presetValue("Survival", setting("enemyDamageFactor"))).toBe(1.5);
    for (const preset of ["Default", "Relaxed", "Hard", "Survival"] as const) {
      expect(presetValue(preset, setting("flameLevelFogRemoval"))).toBe(11);
    }
  });

  it("switches to Custom on an edit, keeping the preset's other values", () => {
    const edited = setWorldValue(serverFile(), setting("bossHealthFactor"), 3);
    expect(edited.gameSettingsPreset).toBe("Custom");
    const game = edited.gameSettings as Record<string, unknown>;
    expect(game.bossHealthFactor).toBe(3);
    expect(game.playerHealthFactor).toBe(2);
    expect(game.tombstoneMode).toBe("NoTombstone");
    expect(game.aNewerSetting).toBe(7);
  });

  it("writes durations in nanoseconds and tidies float noise", () => {
    const doc = setPreset(serverFile(), "Custom");
    const longer = setWorldValue(doc, setting("dayTimeDuration"), 45);
    expect(
      (longer.gameSettings as Record<string, unknown>).dayTimeDuration,
    ).toBe(45 * NS_PER_MINUTE);
    const noisy = setWorldValue(doc, setting("enemyDamageFactor"), 0.1 + 0.2);
    expect(
      (noisy.gameSettings as Record<string, unknown>).enemyDamageFactor,
    ).toBe(0.3);
    const level = setWorldValue(doc, setting("flameLevelFogRemoval"), 6.4);
    expect(
      (level.gameSettings as Record<string, unknown>).flameLevelFogRemoval,
    ).toBe(6);
  });
});

describe("diffSettings", () => {
  it("sends only what changed", () => {
    const saved = serverFile();
    let draft = setWorldValue(saved, setting("enemyDamageFactor"), 2);
    draft = { ...draft, name: "Embervale II" };
    draft = removeBan(draft, "a");
    const changes = diffSettings(saved, draft);
    expect(changes).toContainEqual({
      op: "set",
      path: ["name"],
      value: "Embervale II",
    });
    expect(changes).toContainEqual({
      op: "set",
      path: ["gameSettingsPreset"],
      value: "Custom",
    });
    expect(changes).toContainEqual({
      op: "set",
      path: ["gameSettings", "enemyDamageFactor"],
      value: 2,
    });
    expect(changes).toContainEqual({ op: "unban", accountIdHash: "a" });
    // The unknown setting and untouched bans aren't sent at all.
    expect(JSON.stringify(changes)).not.toContain("aNewerSetting");
    expect(bansOf(draft).map((b) => b.accountIdHash)).toEqual(["b"]);
  });

  it("sends nothing for an unchanged document", () => {
    expect(diffSettings(serverFile(), serverFile())).toEqual([]);
  });

  it("sends the whole document for a file that doesn't exist yet", () => {
    const doc = defaultDocument();
    expect(diffSettings({}, doc).length).toBe(Object.keys(doc).length);
  });
});
