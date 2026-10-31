import { cn } from "cn";
import { RotateCcwIcon } from "lucide-react";
import { memo, useEffect, useId, useState } from "react";
import {
  SEGMENT,
  SEGMENTED,
} from "@/components/server-settings/control-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ValueSource } from "@/lib/server/settings-editor";
import type {
  ChoiceOption,
  ChoiceSetting,
  DurationSetting,
  FactorSetting,
  LevelSetting,
  WorldSetting,
  WorldSettingValue,
} from "@/lib/server/settings-schema";

/** Segmented buttons up to this many options, a dropdown beyond. */
const MAX_SEGMENTS = 4;

const formatWorldValue = (
  setting: WorldSetting,
  value: WorldSettingValue,
): string => {
  switch (setting.kind) {
    case "factor":
      return `${Math.round(Number(value) * 100)}%`;
    case "duration":
      return `${Math.round(Number(value) * 10) / 10} min`;
    case "level":
      return `Level ${value}`;
    case "toggle":
      return value ? "On" : "Off";
    case "choice":
      return (
        setting.options.find((o) => o.value === value)?.label ?? String(value)
      );
  }
};

/** A number field that only commits when the user is done typing. */
const NumberField = ({
  value,
  min,
  max,
  unit,
  label,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  label: string;
  onCommit: (value: number) => void;
}) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const parsed = Number.parseFloat(text.replace(",", "."));
    if (Number.isFinite(parsed)) {
      onCommit(Math.min(max, Math.max(min, parsed)));
    } else {
      setText(String(value));
    }
  };
  return (
    <div className="relative w-20 shrink-0">
      <Input
        inputMode="decimal"
        value={text}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setText(String(value));
        }}
        className={cn("h-8 text-right tabular-nums", unit && "pr-7")}
      />
      {unit ? (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
      ) : null}
    </div>
  );
};

const FactorControl = ({
  setting,
  value,
  onChange,
}: {
  setting: FactorSetting;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center gap-3">
    <Slider
      min={setting.min}
      max={setting.max}
      step={0.05}
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      aria-label={setting.label}
    />
    <NumberField
      value={Math.round(value * 100)}
      min={setting.min * 100}
      max={setting.max * 100}
      unit="%"
      label={`${setting.label} in percent`}
      onCommit={(percent) => onChange(percent / 100)}
    />
  </div>
);

const DurationControl = ({
  setting,
  value,
  onChange,
}: {
  setting: DurationSetting;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center gap-3">
    <Slider
      min={setting.min}
      max={setting.max}
      step={1}
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      aria-label={setting.label}
    />
    <NumberField
      value={Math.round(value * 10) / 10}
      min={setting.min}
      max={setting.max}
      unit="min"
      label={`${setting.label} in minutes`}
      onCommit={onChange}
    />
  </div>
);

const LevelControl = ({
  setting,
  value,
  onChange,
}: {
  setting: LevelSetting;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center gap-3">
    <Slider
      min={setting.min}
      max={setting.max}
      step={1}
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      aria-label={setting.label}
    />
    <NumberField
      value={value}
      min={setting.min}
      max={setting.max}
      label={setting.label}
      onCommit={(v) => onChange(Math.round(v))}
    />
  </div>
);

const OptionDescription = ({ option }: { option?: ChoiceOption }) =>
  option?.description ? (
    <p className="text-xs text-muted-foreground">{option.description}</p>
  ) : null;

const ChoiceControl = ({
  setting,
  value,
  onChange,
}: {
  setting: ChoiceSetting;
  value: string;
  onChange: (value: string) => void;
}) => {
  const known = setting.options.some((o) => o.value === value);
  // A word from a newer server is kept selectable rather than lost.
  const options: ChoiceOption[] = known
    ? setting.options
    : [...setting.options, { value, label: `${value} (from the file)` }];
  const selected = options.find((o) => o.value === value);

  if (options.length > MAX_SEGMENTS) {
    return (
      <div className="space-y-1">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full" aria-label={setting.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <OptionDescription option={selected} />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <ToggleGroup
        type="single"
        size="sm"
        spacing={0.5}
        value={value}
        // Clicking the selected option would clear it; a setting always has
        // a value.
        onValueChange={(v) => v && onChange(v)}
        aria-label={setting.label}
        className={SEGMENTED}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} className={SEGMENT}>
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <OptionDescription option={selected} />
    </div>
  );
};

type WorldSettingRowProps = {
  setting: WorldSetting;
  value: WorldSettingValue;
  source: ValueSource;
  /** The preset playing, when the value comes from one. */
  preset: string | null;
  /** Differs from the saved file. */
  changed: boolean;
  /** Greyed out, e.g. hunger timing while hunger is off. */
  inactive?: boolean;
  onChange: (setting: WorldSetting, value: WorldSettingValue) => void;
};

/** One world setting: what it does, its value and how to change it. */
export const WorldSettingRow = memo(
  ({
    setting,
    value,
    source,
    preset,
    changed,
    inactive = false,
    onChange,
  }: WorldSettingRowProps) => {
    const id = useId();
    const isDefault = value === setting.default;
    const set = (v: WorldSettingValue) => onChange(setting, v);

    return (
      <div
        className={cn(
          "relative grid gap-x-8 gap-y-2.5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:items-center",
          // An ember tick in the gutter marks unsaved edits.
          "before:absolute before:top-4 before:bottom-4 before:-left-4 before:w-0.5 before:rounded-full before:bg-ember before:opacity-0 before:shadow-[0_0_8px_var(--ember)] before:transition-opacity",
          changed && "before:opacity-100",
          inactive && "opacity-55",
        )}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={setting.kind === "toggle" ? id : undefined}
              className="text-sm font-medium"
            >
              {setting.label}
            </label>
            {/* Marks what the preset changes, so picking one shows what it does. */}
            {source === "preset" && preset && !isDefault ? (
              <Badge variant="neutral" className="h-4.5 text-[0.65rem]">
                {preset}
              </Badge>
            ) : null}
            {changed ? (
              <span className="eyebrow text-[0.6rem] text-ember">Unsaved</span>
            ) : null}
          </div>
          <p className="text-[0.8rem] text-pretty text-muted-foreground">
            {setting.description}
            {!isDefault ? (
              <span className="text-muted-foreground/80">
                {" "}
                Default: {formatWorldValue(setting, setting.default)}.
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            {setting.kind === "factor" ? (
              <FactorControl
                setting={setting}
                value={Number(value)}
                onChange={set}
              />
            ) : setting.kind === "duration" ? (
              <DurationControl
                setting={setting}
                value={Number(value)}
                onChange={set}
              />
            ) : setting.kind === "level" ? (
              <LevelControl
                setting={setting}
                value={Number(value)}
                onChange={set}
              />
            ) : setting.kind === "toggle" ? (
              <div className="flex items-center gap-2">
                <Switch
                  id={id}
                  checked={Boolean(value)}
                  onCheckedChange={set}
                />
                <span className="text-sm text-muted-foreground">
                  {value ? "On" : "Off"}
                </span>
              </div>
            ) : (
              <ChoiceControl
                setting={setting}
                value={String(value)}
                onChange={set}
              />
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-7 shrink-0 text-muted-foreground",
                  isDefault && "invisible",
                )}
                aria-label={`Reset ${setting.label} to default`}
                onClick={() => set(setting.default)}
              >
                <RotateCcwIcon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Reset to {formatWorldValue(setting, setting.default)}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  },
);
