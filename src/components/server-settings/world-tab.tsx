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

import { WorldSettingRow } from "@/components/server-settings/world-setting-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
  >
    {PRESETS.map((preset) => {
      const Icon = PRESET_ICONS[preset.value];
      return (
        <RadioGroupPrimitive.Item
          key={preset.value}
          value={preset.value}
          className="group flex flex-col gap-1.5 rounded-lg border bg-card/60 p-3 text-left transition-colors outline-none hover:border-ember/40 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-ember/70 data-[state=checked]:bg-ember/8 data-[state=checked]:shadow-ember"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4 text-muted-foreground group-data-[state=checked]:text-ember" />
            {preset.label}
          </span>
          <span className="text-xs text-pretty text-muted-foreground">
            {preset.description}
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
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Difficulty</CardTitle>
          <CardDescription>
            A preset sets every world setting at once. To set them yourself,
            pick Custom, or just change one below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <PresetPicker
            current={preset}
            onPick={(p) => onChange((doc) => setPreset(doc, p))}
          />
          {knownPreset ? (
            <Alert variant="info">
              <InfoIcon />
              <AlertTitle>
                The {preset} preset decides every value below
              </AlertTitle>
              <AlertDescription>
                The server ignores individual world settings unless the preset
                is Custom. Change any of them and the preset switches to Custom,
                starting from {preset}'s values.
              </AlertDescription>
            </Alert>
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
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
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
            Only settings that differ from the defaults
          </Label>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          {onlyAdjusted && !deferredQuery
            ? "Every world setting is at its default."
            : "No settings match your search."}
        </p>
      ) : null}

      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/60">
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
          </CardContent>
        </Card>
      ))}

      {unknownKeys.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CompassIcon className="size-4 text-shroud" />
              Other world settings
            </CardTitle>
            <CardDescription>
              In the file but not known to this version of the manager (likely
              added by a server update). They're kept exactly as they are.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-1 font-mono text-xs">
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
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
