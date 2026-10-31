import {
  CompassIcon,
  FlameIcon,
  InfoIcon,
  type LucideIcon,
  SearchIcon,
  ShieldIcon,
  SkullIcon,
  SlidersHorizontalIcon,
  SproutIcon,
  XIcon,
} from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useCallback, useDeferredValue, useId, useMemo, useState } from "react";

import { Section } from "@/components/layout/page";
import { WorldSettingRow } from "@/components/server-settings/world-setting-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  changedWorldKeys,
  presetOf,
  type SettingsDoc,
  setPreset,
  setWorldValue,
  unknownWorldKeys,
  worldValue,
} from "@/lib/server/settings-editor";
import {
  isPresetName,
  PRESETS,
  type PresetChoice,
  WORLD_SETTING_GROUPS,
  WORLD_SETTINGS_BY_KEY,
  type WorldSetting,
  type WorldSettingValue,
} from "@/lib/server/settings-schema";

const PRESET_ICONS: Record<PresetChoice, LucideIcon> = {
  Default: FlameIcon,
  Relaxed: SproutIcon,
  Hard: ShieldIcon,
  Survival: SkullIcon,
  Custom: SlidersHorizontalIcon,
};

const PresetPicker = ({
  current,
  onPick,
}: {
  current: string;
  onPick: (preset: PresetChoice) => void;
}) => (
  <RadioGroupPrimitive.Root
    value={current}
    onValueChange={(v) => onPick(v as PresetChoice)}
    aria-label="Difficulty preset"
    className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5"
  >
    {PRESETS.map((preset) => {
      const Icon = PRESET_ICONS[preset.value];
      return (
        <RadioGroupPrimitive.Item
          key={preset.value}
          value={preset.value}
          className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border/80 p-4 text-left transition-all outline-none hover:border-foreground/25 hover:bg-foreground/[0.02] focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=checked]:border-ember/60 data-[state=checked]:bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklch,var(--ember)_14%,transparent),transparent_70%)] data-[state=checked]:shadow-[0_0_24px_-12px_var(--ember)]"
        >
          <span className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg border bg-foreground/[0.03] text-muted-foreground transition-colors group-data-[state=checked]:border-ember/50 group-data-[state=checked]:bg-ember/12 group-data-[state=checked]:text-ember">
              <Icon className="size-4" />
            </span>
            <span className="size-3.5 rounded-full border-2 border-border transition-colors group-data-[state=checked]:border-ember group-data-[state=checked]:bg-ember group-data-[state=checked]:shadow-[0_0_8px_var(--ember)]" />
          </span>
          <span className="space-y-1">
            <span className="block text-sm font-semibold">{preset.label}</span>
            <span className="block text-xs text-pretty text-muted-foreground">
              {preset.description}
            </span>
          </span>
        </RadioGroupPrimitive.Item>
      );
    })}
  </RadioGroupPrimitive.Root>
);

const matches = (setting: WorldSetting, query: string) =>
  !query ||
  `${setting.label} ${setting.description} ${setting.key}`
    .toLowerCase()
    .includes(query);

type WorldTabProps = {
  saved: SettingsDoc;
  draft: SettingsDoc;
  onChange: (update: (doc: SettingsDoc) => SettingsDoc) => void;
};

/** Difficulty preset and the 38 world settings. */
export const WorldTab = ({ saved, draft, onChange }: WorldTabProps) => {
  const [query, setQuery] = useState("");
  const [onlyAdjusted, setOnlyAdjusted] = useState(false);
  const onlyAdjustedId = useId();
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const preset = presetOf(draft);
  const knownPreset = isPresetName(preset);
  const unknownPreset = !knownPreset && preset !== "Custom";
  const changed = useMemo(() => changedWorldKeys(saved, draft), [saved, draft]);
  const unknownKeys = unknownWorldKeys(draft);

  const change = useCallback(
    (setting: WorldSetting, value: WorldSettingValue) =>
      onChange((doc) => setWorldValue(doc, setting, value)),
    [onChange],
  );

  // Hunger timing only matters with hunger on.
  const hunger = WORLD_SETTINGS_BY_KEY.get("enableStarvingDebuff");
  const starving = hunger ? worldValue(draft, hunger).value === true : false;

  const groups = WORLD_SETTING_GROUPS.map((group) => ({
    ...group,
    settings: group.settings.filter((s) => {
      if (!matches(s, deferredQuery)) return false;
      return !onlyAdjusted || worldValue(draft, s).value !== s.default;
    }),
  })).filter((g) => g.settings.length);

  return (
    <div className="space-y-14">
      <Section
        title="Difficulty"
        description="A preset sets every world setting at once. To set them yourself, pick Custom, or just change one below."
      >
        <div className="space-y-4">
          <PresetPicker
            current={preset}
            onPick={(p) => onChange((doc) => setPreset(doc, p))}
          />
          {knownPreset ? (
            <p className="flex items-start gap-2 text-[0.8rem] text-pretty text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-info" />
              <span>
                The server ignores the settings below unless the preset is
                Custom. Change any of them and the preset switches to Custom,
                starting from {preset}'s values.
              </span>
            </p>
          ) : null}
          {unknownPreset ? (
            <Alert variant="warning">
              <InfoIcon />
              <AlertTitle>
                Preset "{preset}" isn't known to this manager
              </AlertTitle>
              <AlertDescription>
                It may come from a newer server version, and is kept as it is.
                The values below are the ones in the file, which the server may
                not be using. Pick a preset to replace it.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </Section>

      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a setting"
            aria-label="Find a world setting"
          />
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <div className="flex items-center gap-2">
          <Switch
            id={onlyAdjustedId}
            checked={onlyAdjusted}
            onCheckedChange={setOnlyAdjusted}
          />
          <Label htmlFor={onlyAdjustedId} className="text-sm font-normal">
            Only what differs from the defaults
          </Label>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="border-y border-dashed py-12 text-center text-sm text-muted-foreground">
          {onlyAdjusted && !deferredQuery
            ? "Every world setting is at its default."
            : "No settings match your search."}
        </p>
      ) : null}

      {groups.map((group) => (
        <Section
          key={group.id}
          id={`world-${group.id}`}
          title={group.title}
          description={group.description}
        >
          <div className="divide-y divide-border/55 border-y border-border/55">
            {group.settings.map((setting) => {
              const { value, source } = worldValue(draft, setting);
              return (
                <WorldSettingRow
                  key={setting.key}
                  setting={setting}
                  value={value}
                  source={source}
                  preset={knownPreset ? preset : null}
                  changed={changed.has(setting.key)}
                  inactive={setting.key === "fromHungerToStarving" && !starving}
                  onChange={change}
                />
              );
            })}
          </div>
        </Section>
      ))}

      {unknownKeys.length ? (
        <Section
          title={
            <span className="flex items-center gap-2">
              <CompassIcon className="size-4 text-shroud" />
              Other world settings
            </span>
          }
          description="In the file but not known to this version of the manager (likely added by a server update). They're kept exactly as they are."
        >
          <dl className="grid gap-1 rounded-lg border bg-console p-4 font-mono text-xs">
            {unknownKeys.map((key) => (
              <div key={key} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{key}</dt>
                <dd>
                  {JSON.stringify(
                    (draft.gameSettings as Record<string, unknown>)[key],
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
    </div>
  );
};
