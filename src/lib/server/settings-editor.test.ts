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
  it("covers all 37 world settings with defaults inside their ranges", () => {
    expect(WORLD_SETTINGS).toHaveLength(37);
    expect(Object.keys(defaultGameSettings())).toHaveLength(37);
    for (const s of WORLD_SETTINGS) {
      if (s.kind === "factor" || s.kind === "duration") {
        expect(s.default).toBeGreaterThanOrEqual(s.min);
        expect(s.default).toBeLessThanOrEqual(s.max);
      }
      if (s.kind === "choice") {
        expect(s.options.map((o) => o.value)).toContain(s.default);
      }
    }
    expect(defaultGameSettings().dayTimeDuration).toBe(30 * NS_PER_MINUTE);
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
