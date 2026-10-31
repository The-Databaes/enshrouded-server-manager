/*
 * Every setting in `enshrouded_server.json` the editor knows: keys, the
 * ranges the server clamps to, the exact words it accepts, defaults and the
 * difficulty presets.
 *
 * Sources, checked against server 1.0.0.0 (Steam build 26083076): the file
 * the server writes on start (all keys, their order and defaults), the
 * effective values it logs at start (the ranges it clamps to, and every
 * preset's values), and its readme (`enshrouded_server_readme.txt`). Before
 * 1.0, Survival Servers' tested settings page:
 * https://www.survivalservers.com/wiki/Enshrouded_Server_Settings
 *
 * Words matter: a misspelled preset, option or tag stops the server, so
 * choices are only ever picked from these lists. Keys the editor doesn't
 * know are left untouched in the file.
 */

/** One minute in the unit the server uses for durations. */
export const NS_PER_MINUTE = 60_000_000_000;

type Base = {
  key: string;
  label: string;
  description: string;
};

export type FactorSetting = Base & {
  kind: "factor";
  min: number;
  max: number;
  default: number;
};

export type DurationSetting = Base & {
  kind: "duration";
  /** In minutes; stored in the file as nanoseconds. */
  min: number;
  max: number;
  default: number;
};

/** A whole number, such as a Flame level. */
export type LevelSetting = Base & {
  kind: "level";
  min: number;
  max: number;
  default: number;
};

export type ToggleSetting = Base & {
  kind: "toggle";
  default: boolean;
};

export type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
};

export type ChoiceSetting = Base & {
  kind: "choice";
  options: ChoiceOption[];
  default: string;
};

export type WorldSetting =
  | FactorSetting
  | DurationSetting
  | LevelSetting
  | ToggleSetting
  | ChoiceSetting;

export type WorldSettingValue = number | boolean | string;

const factor = (
  key: string,
  label: string,
  description: string,
  min: number,
  max: number,
  defaultValue = 1,
): FactorSetting => ({
  kind: "factor",
  key,
  label,
  description,
  min,
  max,
  default: defaultValue,
});

const AMOUNT_OPTIONS: ChoiceOption[] = [
  { value: "Few", label: "Few" },
  { value: "Normal", label: "Normal" },
  // The game's menu calls the file's "Many" More, and "Extreme" Many.
  { value: "Many", label: "More", description: "Twice as many" },
  { value: "Extreme", label: "Most", description: "Three times as many" },
];

/** Enemy amount also has Automatic (1.0), in the order the readme lists. */
const ENEMY_AMOUNT_OPTIONS: ChoiceOption[] = [
  ...AMOUNT_OPTIONS.slice(0, 2),
  {
    value: "Automatic",
    label: "Automatic",
    description:
      "Scales with the party: more enemies the more players are nearby",
  },
  ...AMOUNT_OPTIONS.slice(2),
];

export type SettingGroup = {
  id: string;
  title: string;
  description: string;
  settings: WorldSetting[];
};

/** The 38 world settings under `gameSettings`, grouped as in the game. */
export const WORLD_SETTING_GROUPS: SettingGroup[] = [
  {
    id: "player",
    title: "Player",
    description: "Your character's health, mana, stamina and endurance.",
    settings: [
      factor("playerHealthFactor", "Player health", "Maximum health.", 0.25, 4),
      factor("playerManaFactor", "Player mana", "Maximum mana.", 0.25, 4),
      factor(
        "playerStaminaFactor",
        "Player stamina",
        "Maximum stamina.",
        0.25,
        4,
      ),
      factor(
        "playerBodyHeatFactor",
        "Frost resistance",
        "How long you last in the cold before hypothermia sets in.",
        0.5,
        2,
      ),
      factor(
        "playerDivingTimeFactor",
        "Diving time",
        "How long you can stay underwater.",
        0.75,
        2,
      ),
      factor(
        "shroudTimeFactor",
        "Time in the Shroud",
        "How long you can stay inside the Shroud.",
        0.5,
        2,
      ),
    ],
  },
  {
    id: "survival",
    title: "Survival and death",
    description: "Hunger, food, weapon wear and what dying costs.",
    settings: [
      {
        kind: "toggle",
        key: "enableDurability",
        label: "Weapons wear out",
        description: "Off means weapons never break.",
        default: true,
      },
      {
        kind: "toggle",
        key: "enableStarvingDebuff",
        label: "Hunger and starvation",
        description: "A starving player loses health until they eat or drink.",
        default: false,
      },
      {
        kind: "duration",
        key: "fromHungerToStarving",
        label: "Time until starving",
        description:
          "How long the hungry state lasts before starving starts. Only matters with hunger on.",
        min: 5,
        max: 20,
        default: 10,
      },
      factor(
        "foodBuffDurationFactor",
        "Food buff duration",
        "How long food buffs last.",
        0.5,
        2,
      ),
      {
        kind: "choice",
        key: "tombstoneMode",
        label: "Loot lost on death",
        description: "What goes into your tombstone when you die.",
        default: "AddBackpackMaterials",
        options: [
          {
            value: "NoTombstone",
            label: "Keep everything",
            description: "No tombstone; nothing is dropped",
          },
          {
            value: "AddBackpackMaterials",
            label: "Lose materials",
            description: "Materials from the backpack go in the tombstone",
          },
          {
            value: "Everything",
            label: "Lose everything",
            description: "Everything goes in the tombstone",
          },
        ],
      },
      {
        kind: "choice",
        key: "curseModifier",
        label: "Shroud curse chance",
        description:
          "How likely Shroud enemies are to curse you when they hit.",
        default: "Normal",
        options: [
          { value: "Easy", label: "Off", description: "No curses" },
          { value: "Normal", label: "Normal" },
          { value: "Hard", label: "Double", description: "Twice as likely" },
        ],
      },
    ],
  },
  {
    id: "resources",
    title: "Resources, crafting and XP",
    description: "Gathering, farming, workshops, upgrades and experience.",
    settings: [
      factor(
        "miningDamageFactor",
        "Mining damage",
        "More terraforming and more resources per hit.",
        0.5,
        2,
      ),
      factor(
        "resourceDropStackAmountFactor",
        "Loot amount",
        "Materials per loot stack from chests and enemies.",
        0.25,
        2,
      ),
      factor(
        "plantGrowthSpeedFactor",
        "Plant growth speed",
        "How fast crops grow.",
        0.25,
        2,
      ),
      factor(
        "factoryProductionSpeedFactor",
        "Workshop speed",
        "How fast workshops craft.",
        0.25,
        2,
      ),
      factor(
        "perkCostFactor",
        "Weapon upgrade cost",
        "Runes needed to upgrade a weapon.",
        0.25,
        2,
      ),
      factor(
        "perkUpgradeRecyclingFactor",
        "Rune recycling yield",
        "Share of the runes you get back when you salvage an upgraded weapon.",
        0,
        1,
        0.5,
      ),
      factor(
        "experienceCombatFactor",
        "Combat XP",
        "Experience from fighting.",
        0.25,
        2,
      ),
      factor(
        "experienceMiningFactor",
        "Mining XP",
        "Experience from mining. 0% turns it off.",
        0,
        2,
      ),
      factor(
        "experienceExplorationQuestsFactor",
        "Quest and exploration XP",
        "Experience from exploring and quests.",
        0.25,
        2,
      ),
    ],
  },
  {
    id: "enemies",
    title: "Enemies and bosses",
    description:
      "Enemy numbers and strength. Bosses only follow their own two settings.",
    settings: [
      {
        kind: "choice",
        key: "randomSpawnerAmount",
        label: "Enemy amount",
        description: "How many enemies spawn.",
        default: "Automatic",
        options: ENEMY_AMOUNT_OPTIONS,
      },
      {
        kind: "choice",
        key: "aggroPoolAmount",
        label: "Simultaneous attackers",
        description: "How many enemies may attack you at the same time.",
        default: "Normal",
        options: AMOUNT_OPTIONS,
      },
      // 1.0 reworked this slider: the server now caps it at 2.5 (was 5).
      factor(
        "enemyDamageFactor",
        "Enemy damage",
        "Damage enemies deal.",
        0.25,
        2.5,
      ),
      factor("enemyHealthFactor", "Enemy health", "Enemy health.", 0.25, 4),
      factor(
        "enemyStaminaFactor",
        "Enemy stamina",
        "Higher takes longer to stun.",
        0.5,
        2,
      ),
      factor(
        "enemyPerceptionRangeFactor",
        "Enemy perception",
        "How far enemies see and hear you.",
        0.5,
        2,
      ),
      factor(
        "threatBonus",
        "Enemy attack frequency",
        "How often enemies attack.",
        0.25,
        4,
      ),
      {
        kind: "toggle",
        key: "pacifyAllEnemies",
        label: "Peaceful enemies",
        description: "Enemies don't attack until you attack them.",
        default: false,
      },
      factor(
        "bossDamageFactor",
        "Boss damage",
        "Damage from boss attacks.",
        0.2,
        5,
      ),
      factor("bossHealthFactor", "Boss health", "Boss health.", 0.2, 4),
    ],
  },
  {
    id: "world",
    title: "World",
    description:
      "Day and night, weather, the Shroud, fishing, gliding and taming.",
    settings: [
      {
        kind: "duration",
        key: "dayTimeDuration",
        label: "Day length",
        description: "Real time from sunrise to sunset.",
        min: 2,
        max: 60,
        default: 30,
      },
      {
        kind: "duration",
        key: "nightTimeDuration",
        label: "Night length",
        description: "Real time from sunset to sunrise.",
        min: 2,
        max: 60,
        default: 12,
      },
      {
        kind: "choice",
        key: "weatherFrequency",
        label: "Harsh weather",
        description: "How often storms and other harsh weather appear.",
        default: "Normal",
        options: [
          { value: "Disabled", label: "Off" },
          { value: "Rare", label: "Rare" },
          { value: "Normal", label: "Normal" },
          { value: "Often", label: "Often" },
        ],
      },
      {
        // New in 1.0. The readme says 0-20, but the server plays 1-11: it
        // lowers higher values to 11 and raises 0 to 1.
        kind: "level",
        key: "flameLevelFogRemoval",
        label: "Flame Altars in the Shroud",
        description:
          "The Flame level needed to place Flame Altars inside the Shroud and push it back.",
        min: 1,
        max: 11,
        default: 11,
      },
      {
        kind: "choice",
        key: "fishingDifficulty",
        label: "Fishing difficulty",
        description: "How hard fish fight in the fishing minigame.",
        default: "Normal",
        options: [
          { value: "VeryEasy", label: "Very easy" },
          { value: "Easy", label: "Easy" },
          { value: "Normal", label: "Normal" },
          { value: "Hard", label: "Hard" },
          { value: "VeryHard", label: "Very hard" },
        ],
      },
      {
        kind: "toggle",
        key: "enableGliderTurbulences",
        label: "Glider turbulence",
        description: "Air turbulence while gliding.",
        default: true,
      },
      {
        kind: "choice",
        key: "tamingStartleRepercussion",
        label: "Startling while taming",
        description: "Taming progress lost when you scare an animal.",
        default: "LoseSomeProgress",
        options: [
          { value: "KeepProgress", label: "Keep progress" },
          { value: "LoseSomeProgress", label: "Lose some" },
          { value: "LoseAllProgress", label: "Lose all" },
        ],
      },
    ],
  },
];

export const WORLD_SETTINGS: WorldSetting[] = WORLD_SETTING_GROUPS.flatMap(
  (g) => g.settings,
);

export const WORLD_SETTINGS_BY_KEY = new Map(
  WORLD_SETTINGS.map((s) => [s.key, s]),
);

/** The order the server writes `gameSettings` in. */
const SERVER_KEY_ORDER = [
  "playerHealthFactor",
  "playerManaFactor",
  "playerStaminaFactor",
  "playerBodyHeatFactor",
  "playerDivingTimeFactor",
  "enableDurability",
  "enableStarvingDebuff",
  "foodBuffDurationFactor",
  "fromHungerToStarving",
  "shroudTimeFactor",
  "tombstoneMode",
  "enableGliderTurbulences",
  "weatherFrequency",
  "fishingDifficulty",
  "miningDamageFactor",
  "plantGrowthSpeedFactor",
  "resourceDropStackAmountFactor",
  "factoryProductionSpeedFactor",
  "perkUpgradeRecyclingFactor",
  "perkCostFactor",
  "experienceCombatFactor",
  "experienceMiningFactor",
  "experienceExplorationQuestsFactor",
  "randomSpawnerAmount",
  "aggroPoolAmount",
  "enemyDamageFactor",
  "enemyHealthFactor",
  "enemyStaminaFactor",
  "enemyPerceptionRangeFactor",
  "bossDamageFactor",
  "bossHealthFactor",
  "threatBonus",
  "pacifyAllEnemies",
  "tamingStartleRepercussion",
  "dayTimeDuration",
  "nightTimeDuration",
  "curseModifier",
  "flameLevelFogRemoval",
];

/** How a setting is written in the file (durations in nanoseconds). */
export const toFileValue = (
  setting: WorldSetting,
  value: WorldSettingValue,
): WorldSettingValue => {
  switch (setting.kind) {
    case "duration":
      return Math.round(Number(value) * NS_PER_MINUTE);
    case "level":
      return Math.round(Number(value));
    default:
      return value;
  }
};

/** How the editor shows a value read from the file. */
export const fromFileValue = (
  setting: WorldSetting,
  value: unknown,
): WorldSettingValue | undefined => {
  switch (setting.kind) {
    case "factor":
    case "level":
      return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
    case "duration":
      return typeof value === "number" && Number.isFinite(value)
        ? value / NS_PER_MINUTE
        : undefined;
    case "toggle":
      return typeof value === "boolean" ? value : undefined;
    case "choice":
      return typeof value === "string" ? value : undefined;
  }
};

/** Every world setting at its default, in file form and server order. */
export const defaultGameSettings = (): Record<string, WorldSettingValue> =>
  Object.fromEntries(
    SERVER_KEY_ORDER.map((key) => {
      const setting = WORLD_SETTINGS_BY_KEY.get(key);
      if (!setting) throw new Error(`No world setting called ${key}`);
      return [key, toFileValue(setting, setting.default)];
    }),
  );

// ---- difficulty presets ------------------------------------------------

export type PresetName = "Default" | "Relaxed" | "Hard" | "Survival";
export type PresetChoice = PresetName | "Custom";

export type PresetInfo = {
  value: PresetChoice;
  label: string;
  description: string;
};

export const PRESETS: PresetInfo[] = [
  {
    value: "Default",
    label: "Default",
    description: "The game as designed. Recommended for a first world.",
  },
  {
    value: "Relaxed",
    label: "Relaxed",
    description:
      "Fewer, weaker enemies, more loot and faster crafting. You keep everything when you die.",
  },
  {
    value: "Hard",
    label: "Hard",
    description:
      "More enemies that hit harder and attack more often, and less XP.",
  },
  {
    value: "Survival",
    label: "Survival",
    description:
      "Hard, plus hunger, longer nights, harsher weather and losing everything on death.",
  },
  {
    value: "Custom",
    label: "Custom",
    description: "Set every value below yourself.",
  },
];

/** Editor values (minutes for durations) that differ from the defaults. */
const PRESET_CHANGES: Record<PresetName, Record<string, WorldSettingValue>> = {
  Default: {},
  Relaxed: {
    playerHealthFactor: 2,
    playerManaFactor: 2,
    playerStaminaFactor: 2,
    playerBodyHeatFactor: 2,
    playerDivingTimeFactor: 1.5,
    shroudTimeFactor: 1.5,
    enableDurability: false,
    foodBuffDurationFactor: 1.5,
    tombstoneMode: "NoTombstone",
    curseModifier: "Easy",
    miningDamageFactor: 1.5,
    resourceDropStackAmountFactor: 1.5,
    plantGrowthSpeedFactor: 2,
    factoryProductionSpeedFactor: 2,
    perkCostFactor: 0.5,
    perkUpgradeRecyclingFactor: 1,
    experienceCombatFactor: 1.5,
    experienceMiningFactor: 1.25,
    randomSpawnerAmount: "Few",
    aggroPoolAmount: "Few",
    enemyDamageFactor: 0.5,
    enemyHealthFactor: 0.5,
    enemyStaminaFactor: 0.5,
    enemyPerceptionRangeFactor: 0.75,
    threatBonus: 0.5,
    bossDamageFactor: 0.5,
    bossHealthFactor: 0.5,
    weatherFrequency: "Rare",
    fishingDifficulty: "Easy",
    enableGliderTurbulences: false,
    tamingStartleRepercussion: "KeepProgress",
  },
  Hard: {
    playerDivingTimeFactor: 0.9,
    foodBuffDurationFactor: 0.9,
    experienceCombatFactor: 0.5,
    experienceMiningFactor: 0.5,
    randomSpawnerAmount: "Many",
    enemyDamageFactor: 1.25,
    threatBonus: 1.5,
    bossHealthFactor: 1.5,
  },
  Survival: {
    playerHealthFactor: 0.75,
    playerBodyHeatFactor: 0.75,
    playerDivingTimeFactor: 0.75,
    enableStarvingDebuff: true,
    foodBuffDurationFactor: 0.7,
    tombstoneMode: "Everything",
    curseModifier: "Hard",
    miningDamageFactor: 0.75,
    resourceDropStackAmountFactor: 0.75,
    perkCostFactor: 1.25,
    perkUpgradeRecyclingFactor: 0.3,
    experienceCombatFactor: 0.5,
    experienceMiningFactor: 0.5,
    randomSpawnerAmount: "Many",
    enemyDamageFactor: 1.5,
    threatBonus: 1.5,
    bossHealthFactor: 1.5,
    weatherFrequency: "Often",
    fishingDifficulty: "Hard",
    tamingStartleRepercussion: "LoseAllProgress",
    nightTimeDuration: 20,
  },
};

export const isPresetName = (value: unknown): value is PresetName =>
  typeof value === "string" && value in PRESET_CHANGES;

/** The value a preset plays for a setting (editor units). */
export const presetValue = (
  preset: PresetName,
  setting: WorldSetting,
): WorldSettingValue => PRESET_CHANGES[preset][setting.key] ?? setting.default;

// ---- the rest of the file ------------------------------------------------

export const SLOT_LIMIT = 16;
export const DEFAULT_QUERY_PORT = 15637;

export type TagGroup = {
  title: string;
  tags: { value: string; label: string }[];
};

/** The server-list tags the server accepts; any other word stops it. */
export const TAG_GROUPS: TagGroup[] = [
  {
    title: "Community",
    tags: [{ value: "LookingForPlayers", label: "Looking for players" }],
  },
  {
    title: "Play style",
    tags: [
      { value: "BaseBuilding", label: "Base building" },
      { value: "Exploration", label: "Exploration" },
      { value: "Roleplay", label: "Roleplay" },
    ],
  },
  {
    title: "Languages",
    tags: [
      "English",
      "German",
      "French",
      "Italian",
      "Japanese",
      "Korean",
      "Polish",
      "Portuguese",
      "Russian",
      "Spanish",
      "Thai",
      "Turkish",
      "Ukrainian",
      "Chinese",
      "Taiwanese",
    ].map((value) => ({ value, label: value })),
  },
];

export const KNOWN_TAGS = new Set(
  TAG_GROUPS.flatMap((g) => g.tags.map((t) => t.value)),
);

export const VOICE_CHAT_MODES: ChoiceOption[] = [
  {
    value: "Proximity",
    label: "Proximity",
    description: "Hear players near you",
  },
  { value: "Global", label: "Global", description: "Hear everyone" },
];

export type Permission = {
  key: string;
  label: string;
  description: string;
};

/** What a role (user group) may do, in the order the server writes them. */
export const PERMISSIONS: Permission[] = [
  {
    key: "canKickBan",
    label: "Kick and ban",
    description: "Remove players from the server, for now or for good.",
  },
  {
    key: "canAccessInventories",
    label: "Use containers",
    description:
      "Open chests, workshops and other containers in bases. Treasure chests in the open world are always open.",
  },
  {
    key: "canEditWorld",
    label: "Change the world",
    description:
      "Terraform and destroy outside bases. Turn off to guard against griefing.",
  },
  {
    key: "canEditBase",
    label: "Build in bases",
    description: "Build, remove and terraform inside bases, including water.",
  },
  {
    key: "canExtendBase",
    label: "Manage Flame Altars",
    description: "Place, remove and upgrade Flame Altars.",
  },
];

export type RoleTemplate = {
  name: string;
  description: string;
  permissions: Record<string, boolean>;
};

/** The roles a fresh server file starts with. */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: "Admin",
    description: "Everything, including kicking and banning.",
    permissions: {
      canKickBan: true,
      canAccessInventories: true,
      canEditWorld: true,
      canEditBase: true,
      canExtendBase: true,
    },
  },
  {
    name: "Friend",
    description: "Builds and uses containers, can't manage Flame Altars.",
    permissions: {
      canKickBan: false,
      canAccessInventories: true,
      canEditWorld: true,
      canEditBase: true,
      canExtendBase: false,
    },
  },
  {
    name: "Guest",
    description: "Plays the world, can't touch bases or containers.",
    permissions: {
      canKickBan: false,
      canAccessInventories: false,
      canEditWorld: true,
      canEditBase: false,
      canExtendBase: false,
    },
  },
  {
    name: "Visitor",
    description: "Looks around without changing anything.",
    permissions: {
      canKickBan: false,
      canAccessInventories: false,
      canEditWorld: false,
      canEditBase: false,
      canExtendBase: false,
    },
  },
];

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** A random password without look-alike characters, easy to read out. */
export const generatePassword = (length = 12) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(
    bytes,
    (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length],
  ).join("");
};

export const roleFromTemplate = (
  template: RoleTemplate,
  name = template.name,
) => ({
  name,
  password: generatePassword(),
  ...template.permissions,
  reservedSlots: 0,
});

/** What the server writes when it creates the file, for a server that
 * hasn't started yet. */
export const defaultDocument = (): Record<string, unknown> => ({
  name: "Enshrouded Server",
  saveDirectory: "./savegame",
  logDirectory: "./logs",
  ip: "0.0.0.0",
  queryPort: DEFAULT_QUERY_PORT,
  slotCount: SLOT_LIMIT,
  tags: [],
  voiceChatMode: "Proximity",
  enableVoiceChat: false,
  enableTextChat: false,
  gameSettingsPreset: "Default",
  gameSettings: defaultGameSettings(),
  userGroups: ROLE_TEMPLATES.map((t) => roleFromTemplate(t)),
  bannedAccounts: [],
});
