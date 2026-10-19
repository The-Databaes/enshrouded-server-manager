/*
 * Editing the settings file as plain JSON, so keys the editor doesn't know
 * ride along untouched. Every edit returns a new document.
 */
import {
  fromFileValue,
  isPresetName,
  type PresetChoice,
  presetValue,
  toFileValue,
  WORLD_SETTINGS,
  type WorldSetting,
  type WorldSettingValue,
} from "@/lib/server/settings-schema";

export type SettingsDoc = Record<string, unknown>;

/** Mirrors `Change` in `src-tauri/src/server/settings_file.rs`. */
export type SettingsChange =
  | { op: "set"; path: string[]; value: unknown }
  | { op: "unban"; accountIdHash: string };

export type Ban = {
  accountIdHash: string;
  displayName?: string;
  characterName?: string;
  /** Unix seconds. */
  banDate?: number;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const gameSettingsOf = (doc: SettingsDoc): Record<string, unknown> =>
  isObject(doc.gameSettings) ? doc.gameSettings : {};

/** The preset word in the file (may be one this version doesn't know). */
export const presetOf = (doc: SettingsDoc): string =>
  typeof doc.gameSettingsPreset === "string"
    ? doc.gameSettingsPreset
    : "Default";

/** Where a world setting's effective value comes from. */
export type ValueSource = "preset" | "file" | "default";

/**
 * The value the server will play. Unless the preset is Custom it ignores
 * `gameSettings` and plays the preset's own values.
 */
export const worldValue = (
  doc: SettingsDoc,
  setting: WorldSetting,
): { value: WorldSettingValue; source: ValueSource } => {
  const preset = presetOf(doc);
  if (isPresetName(preset)) {
    return { value: presetValue(preset, setting), source: "preset" };
  }
  const fromFile = fromFileValue(setting, gameSettingsOf(doc)[setting.key]);
  // A word this version doesn't know (from a newer server) is shown as is.
  return fromFile === undefined
    ? { value: setting.default, source: "default" }
    : { value: fromFile, source: "file" };
};

/** Round away float noise (0.1 + 0.2) without losing intended precision. */
const tidy = (n: number) => Math.round(n * 1000) / 1000;

const withGameSettings = (
  doc: SettingsDoc,
  values: Record<string, unknown>,
  preset: string,
): SettingsDoc => ({
  ...doc,
  gameSettingsPreset: preset,
  gameSettings: { ...gameSettingsOf(doc), ...values },
});

/** Every world setting as the preset plays it, in file form. */
const presetFileValues = (doc: SettingsDoc) =>
  Object.fromEntries(
    WORLD_SETTINGS.map((s) => [
      s.key,
      toFileValue(s, worldValue(doc, s).value),
    ]),
  );

/**
 * Change one world setting. On a preset other than Custom this switches to
 * Custom, starting from the values the preset was playing, so nothing else
 * changes under the user.
 */
export const setWorldValue = (
  doc: SettingsDoc,
  setting: WorldSetting,
  value: WorldSettingValue,
): SettingsDoc => {
  const clean = typeof value === "number" ? tidy(value) : value;
  const carried = presetOf(doc) === "Custom" ? {} : presetFileValues(doc);
  return withGameSettings(
    doc,
    { ...carried, [setting.key]: toFileValue(setting, clean) },
    "Custom",
  );
};

/** Pick a difficulty preset. Picking Custom carries over the current
 * preset's values, so it starts from what was being played. */
export const setPreset = (
  doc: SettingsDoc,
  preset: PresetChoice,
): SettingsDoc => {
  if (preset === presetOf(doc)) return doc;
  if (preset === "Custom") {
    return withGameSettings(doc, presetFileValues(doc), "Custom");
  }
  return { ...doc, gameSettingsPreset: preset };
};

export const setTopLevel = (
  doc: SettingsDoc,
  key: string,
  value: unknown,
): SettingsDoc => ({ ...doc, [key]: value });

export const bansOf = (doc: SettingsDoc): Ban[] => {
  const list = Array.isArray(doc.bannedAccounts)
    ? doc.bannedAccounts
    : Array.isArray(doc.bans)
      ? doc.bans
      : [];
  return list.filter(
    (b): b is Ban => isObject(b) && typeof b.accountIdHash === "string",
  );
};

export const removeBan = (doc: SettingsDoc, hash: string): SettingsDoc => {
  const next = { ...doc };
  for (const key of ["bannedAccounts", "bans"]) {
    const list = next[key];
    if (Array.isArray(list)) {
      next[key] = list.filter(
        (b) => !(isObject(b) && b.accountIdHash === hash),
      );
    }
  }
  return next;
};

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const BAN_KEYS = new Set(["bannedAccounts", "bans"]);

/**
 * What to send to the backend to turn `saved` into `draft`: only what
 * changed, so whatever else is in the file on disk is kept.
 */
export const diffSettings = (
  saved: SettingsDoc,
  draft: SettingsDoc,
): SettingsChange[] => {
  const changes: SettingsChange[] = [];
  for (const [key, value] of Object.entries(draft)) {
    if (BAN_KEYS.has(key) && key in saved) continue;
    if (key === "gameSettings" && isObject(value) && isObject(saved[key])) {
      const before = saved[key] as Record<string, unknown>;
      for (const [k, v] of Object.entries(value)) {
        if (!same(before[k], v)) {
          changes.push({ op: "set", path: ["gameSettings", k], value: v });
        }
      }
      continue;
    }
    if (!same(saved[key], value)) {
      changes.push({ op: "set", path: [key], value });
    }
  }
  const kept = new Set(bansOf(draft).map((b) => b.accountIdHash));
  for (const ban of bansOf(saved)) {
    if (!kept.has(ban.accountIdHash)) {
      changes.push({ op: "unban", accountIdHash: ban.accountIdHash });
    }
  }
  return changes;
};

/** Keys whose value differs between the two documents, for highlighting. */
export const changedWorldKeys = (saved: SettingsDoc, draft: SettingsDoc) =>
  new Set(
    WORLD_SETTINGS.filter(
      (s) => !same(worldValue(saved, s).value, worldValue(draft, s).value),
    ).map((s) => s.key),
  );

/** World settings in the file this version of the manager doesn't know. */
export const unknownWorldKeys = (doc: SettingsDoc) => {
  const known = new Set(WORLD_SETTINGS.map((s) => s.key));
  return Object.keys(gameSettingsOf(doc)).filter((k) => !known.has(k));
};

export type Problem = {
  /** Where it is: a top-level key, or `role:<index>`. */
  field: string;
  message: string;
  /** Blocks saving (the server wouldn't start, or it's clearly a mistake). */
  blocking: boolean;
};

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const looksLikeIp = (s: string) =>
  IPV4.test(s) || (s.includes(":") && /^[0-9a-f:.]+$/i.test(s));

export type Role = Record<string, unknown> & {
  name?: unknown;
  password?: unknown;
  reservedSlots?: unknown;
};

/** The roles with their position in the file's list (which `updateRole`
 * and `removeRole` take). */
export const roleEntries = (
  doc: SettingsDoc,
): { role: Role; index: number }[] =>
  (Array.isArray(doc.userGroups) ? doc.userGroups : []).flatMap(
    (role, index) => (isObject(role) ? [{ role: role as Role, index }] : []),
  );

/** Everything wrong with a draft, before it gets near the server. */
export const validateSettings = (doc: SettingsDoc): Problem[] => {
  const problems: Problem[] = [];
  const block = (field: string, message: string) =>
    problems.push({ field, message, blocking: true });

  if (typeof doc.name !== "string" || !doc.name.trim()) {
    block("name", "The server needs a name.");
  }
  const slots = doc.slotCount;
  if (
    !(
      Number.isInteger(slots) &&
      (slots as number) >= 1 &&
      (slots as number) <= 16
    )
  ) {
    block("slotCount", "Player slots must be a whole number from 1 to 16.");
  }
  const port = doc.queryPort;
  if (
    !(
      Number.isInteger(port) &&
      (port as number) >= 1 &&
      (port as number) <= 65535
    )
  ) {
    block("queryPort", "The port must be a whole number from 1 to 65535.");
  }
  if (typeof doc.ip !== "string" || !looksLikeIp(doc.ip.trim())) {
    block(
      "ip",
      "Enter an IP address, such as 0.0.0.0 for every network adapter.",
    );
  }
  for (const key of ["saveDirectory", "logDirectory"]) {
    if (typeof doc[key] !== "string" || !(doc[key] as string).trim()) {
      block(key, "Enter a folder, such as ./savegame.");
    }
  }

  const seen = new Map<string, number>();
  let reserved = 0;
  for (const { role, index: i } of roleEntries(doc)) {
    const name = typeof role.name === "string" ? role.name.trim() : "";
    if (!name) block(`role:${i}`, "Every role needs a name.");
    else if (seen.has(name.toLowerCase()))
      block(`role:${i}`, `There's already a role called "${name}".`);
    seen.set(name.toLowerCase(), i);
    if (typeof role.password === "string" && !role.password) {
      problems.push({
        field: `role:${i}`,
        message: `Anyone can join as ${name || "this role"}: it has no password.`,
        blocking: false,
      });
    }
    if (typeof role.reservedSlots === "number") reserved += role.reservedSlots;
  }
  if (Number.isInteger(slots) && reserved > (slots as number)) {
    problems.push({
      field: "userGroups",
      message: `Roles reserve ${reserved} slots, but the server only has ${slots}.`,
      blocking: false,
    });
  }
  return problems;
};

const rawRoles = (doc: SettingsDoc): unknown[] =>
  Array.isArray(doc.userGroups) ? doc.userGroups : [];

/** Merge `patch` into role `index`, keeping its other fields (including
 * permissions a newer server added). */
export const updateRole = (
  doc: SettingsDoc,
  index: number,
  patch: Record<string, unknown>,
): SettingsDoc => ({
  ...doc,
  userGroups: rawRoles(doc).map((role, i) =>
    i === index && isObject(role) ? { ...role, ...patch } : role,
  ),
});

export const addRole = (doc: SettingsDoc, role: Role): SettingsDoc => ({
  ...doc,
  userGroups: [...rawRoles(doc), role],
});

export const removeRole = (doc: SettingsDoc, index: number): SettingsDoc => ({
  ...doc,
  userGroups: rawRoles(doc).filter((_, i) => i !== index),
});
