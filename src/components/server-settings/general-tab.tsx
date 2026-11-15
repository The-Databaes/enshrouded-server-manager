import { cn } from "cn";
import { ChevronDownIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { Section, SettingList, SettingRow } from "@/components/layout/page";
import {
  PILL,
  SEGMENT,
  SEGMENTED,
} from "@/components/server-settings/control-styles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type Problem,
  type SettingsDoc,
  setTopLevel,
} from "@/lib/server/settings-editor";
import {
  KNOWN_TAGS,
  SLOT_LIMIT,
  TAG_GROUPS,
  VOICE_CHAT_MODES,
} from "@/lib/server/settings-schema";

type Update = (update: (doc: SettingsDoc) => SettingsDoc) => void;

const text = (doc: SettingsDoc, key: string) =>
  typeof doc[key] === "string" ? (doc[key] as string) : "";

/** A number input that keeps what the user typed until it's a number. */
const IntegerInput = ({
  id,
  value,
  onChange,
  invalid,
  className,
}: {
  id: string;
  value: unknown;
  onChange: (value: number | string) => void;
  invalid: boolean;
  className?: string;
}) => (
  <Input
    id={id}
    inputMode="numeric"
    value={typeof value === "number" || typeof value === "string" ? value : ""}
    aria-invalid={invalid || undefined}
    onChange={(e) => {
      const raw = e.target.value.trim();
      onChange(/^\d+$/.test(raw) ? Number(raw) : raw);
    }}
    className={cn("tabular-nums", className)}
  />
);

/** A switch with its state written next to it. */
export const LabelledSwitch = ({
  id,
  checked,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) => (
  <div className="flex items-center gap-2.5">
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    <span
      className={cn(
        "text-sm",
        checked ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {checked ? "On" : "Off"}
    </span>
  </div>
);

type GeneralTabProps = {
  draft: SettingsDoc;
  saved: SettingsDoc;
  problems: Problem[];
  onChange: Update;
};

/** Name, slots, server-list tags, chat, and network/folders. */
export const GeneralTab = ({
  draft,
  saved,
  problems,
  onChange,
}: GeneralTabProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const id = useId();
  const errorFor = (field: string) =>
    problems.find((p) => p.field === field && p.blocking)?.message;
  const set = (key: string, value: unknown) =>
    onChange((doc) => setTopLevel(doc, key, value));
  const changed = (...keys: string[]) =>
    keys.some((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k]));

  const tags = Array.isArray(draft.tags)
    ? draft.tags.filter((t): t is string => typeof t === "string")
    : [];
  const unknownTags = tags.filter((t) => !KNOWN_TAGS.has(t));
  const slots = typeof draft.slotCount === "number" ? draft.slotCount : 16;
  const voice = draft.enableVoiceChat === true;
  const advancedFields = ["ip", "queryPort", "saveDirectory", "logDirectory"];
  const advancedError = advancedFields.some((f) => errorFor(f));
  const advancedChanged = changed(...advancedFields);

  const removeTag = (tag: string) =>
    set(
      "tags",
      tags.filter((t) => t !== tag),
    );

  return (
    <div className="space-y-14">
      <Section
        title="Listing"
        description="How the server appears in the game's server list."
      >
        <SettingList>
          <SettingRow
            label="Server name"
            htmlFor={`${id}-server-name`}
            description="What players search for. Please keep it friendly."
            error={errorFor("name")}
            changed={changed("name")}
          >
            <Input
              id={`${id}-server-name`}
              value={text(draft, "name")}
              maxLength={64}
              aria-invalid={Boolean(errorFor("name")) || undefined}
              onChange={(e) => set("name", e.target.value)}
            />
          </SettingRow>
          <SettingRow
            label="Player slots"
            htmlFor={`${id}-slot-count`}
            description={`How many players can be on at once, up to ${SLOT_LIMIT}.`}
            error={errorFor("slotCount")}
            changed={changed("slotCount")}
          >
            <div className="flex items-center gap-3">
              <Slider
                min={1}
                max={SLOT_LIMIT}
                step={1}
                value={[Math.min(SLOT_LIMIT, Math.max(1, slots))]}
                onValueChange={([v]) => set("slotCount", v)}
                aria-label="Player slots"
              />
              <IntegerInput
                id={`${id}-slot-count`}
                value={draft.slotCount}
                invalid={Boolean(errorFor("slotCount"))}
                onChange={(v) => set("slotCount", v)}
                className="h-8 w-16 shrink-0 text-right"
              />
            </div>
          </SettingRow>
          <div
            data-changed={changed("tags") || undefined}
            className="relative space-y-4 py-5 before:absolute before:top-5 before:bottom-5 before:-left-4 before:w-0.5 before:rounded-full before:bg-ember before:opacity-0 before:shadow-[0_0_8px_var(--ember)] data-changed:before:opacity-100"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">Tags</p>
              <p className="text-[0.8rem] text-muted-foreground">
                Help players find a server that suits them: the server list can
                be filtered by these.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-[7rem_minmax(0,1fr)] md:gap-y-3">
              {TAG_GROUPS.map((group) => (
                <div key={group.title} className="contents">
                  <p className="eyebrow pt-2">{group.title}</p>
                  <ToggleGroup
                    type="multiple"
                    spacing={1.5}
                    value={tags}
                    // `value` holds every tag, so the new list includes the
                    // other groups' tags (and unknown ones) unchanged.
                    onValueChange={(next) => set("tags", next)}
                    className="flex-wrap justify-start"
                    aria-label={`${group.title} tags`}
                  >
                    {group.tags.map((tag) => (
                      <ToggleGroupItem
                        key={tag.value}
                        value={tag.value}
                        className={PILL}
                      >
                        {tag.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              ))}
            </div>
            {unknownTags.length ? (
              <Alert variant="warning">
                <TriangleAlertIcon />
                <AlertDescription>
                  <p>
                    These tags aren't known to this manager. The current server
                    may not start with them; remove them unless a newer server
                    added them.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {unknownTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 py-0.5 pr-1 pl-2.5 text-xs text-warning"
                      >
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove tag ${tag}`}
                          onClick={() => removeTag(tag)}
                          className="rounded-full p-0.5 hover:bg-warning/20"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </SettingList>
      </Section>

      <Section title="Chat" description="Both are off on a new server.">
        <SettingList>
          <SettingRow
            label="Text chat"
            htmlFor={`${id}-text-chat`}
            description="Players can type messages to each other."
            changed={changed("enableTextChat")}
          >
            <LabelledSwitch
              id={`${id}-text-chat`}
              checked={draft.enableTextChat === true}
              onCheckedChange={(on) => set("enableTextChat", on)}
            />
          </SettingRow>
          <SettingRow
            label="Voice chat"
            htmlFor={`${id}-voice-chat`}
            description="Players can talk over their microphones."
            changed={changed("enableVoiceChat")}
          >
            <LabelledSwitch
              id={`${id}-voice-chat`}
              checked={voice}
              onCheckedChange={(on) => set("enableVoiceChat", on)}
            />
          </SettingRow>
          <SettingRow
            label="Who you hear"
            description={
              voice
                ? "Proximity is like talking in person; Global is a group call."
                : "Turn voice chat on to choose."
            }
            changed={changed("voiceChatMode")}
            inactive={!voice}
          >
            <ToggleGroup
              type="single"
              size="sm"
              spacing={0.5}
              disabled={!voice}
              value={text(draft, "voiceChatMode") || "Proximity"}
              onValueChange={(v) => v && set("voiceChatMode", v)}
              aria-label="Voice chat mode"
              className={SEGMENTED}
            >
              {VOICE_CHAT_MODES.map((mode) => (
                <ToggleGroupItem
                  key={mode.value}
                  value={mode.value}
                  className={SEGMENT}
                >
                  {mode.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SettingRow>
        </SettingList>
      </Section>

      <Collapsible
        open={advancedOpen || advancedError}
        onOpenChange={setAdvancedOpen}
      >
        <section className="space-y-5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-start justify-between gap-4 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <div className="space-y-1.5">
                <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold">
                  Network and folders
                  {advancedChanged ? (
                    <span className="size-1.5 rounded-full bg-ember shadow-[0_0_6px_var(--ember)]" />
                  ) : null}
                </h2>
                <p className="text-[0.84rem] text-muted-foreground">
                  Advanced. The defaults suit almost every server.
                </p>
              </div>
              <span className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground group-hover:text-foreground">
                {advancedOpen || advancedError ? "Hide" : "Show"}
                <ChevronDownIcon
                  className={cn(
                    "size-4 transition-transform",
                    (advancedOpen || advancedError) && "rotate-180",
                  )}
                />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SettingList>
              <SettingRow
                label="Query port"
                htmlFor={`${id}-query-port`}
                description="The UDP port players connect on. To let players in from the internet, forward it on your router."
                error={errorFor("queryPort")}
                changed={changed("queryPort")}
              >
                <IntegerInput
                  id={`${id}-query-port`}
                  value={draft.queryPort}
                  invalid={Boolean(errorFor("queryPort"))}
                  onChange={(v) => set("queryPort", v)}
                />
              </SettingRow>
              <SettingRow
                label="Listen address"
                htmlFor={`${id}-listen-ip`}
                description="0.0.0.0 listens on every network adapter. Only change this to tie the server to one adapter."
                error={errorFor("ip")}
                changed={changed("ip")}
              >
                <Input
                  id={`${id}-listen-ip`}
                  value={text(draft, "ip")}
                  aria-invalid={Boolean(errorFor("ip")) || undefined}
                  onChange={(e) => set("ip", e.target.value)}
                  className="font-mono"
                />
              </SettingRow>
              <SettingRow
                label="Save folder"
                htmlFor={`${id}-save-dir`}
                description={
                  <>
                    Where the world is saved, relative to the server's folder.{" "}
                    <span className="text-warning">
                      Pointing it somewhere else starts the server on the world
                      in that folder, or a new one.
                    </span>
                  </>
                }
                error={errorFor("saveDirectory")}
                changed={changed("saveDirectory")}
              >
                <Input
                  id={`${id}-save-dir`}
                  value={text(draft, "saveDirectory")}
                  aria-invalid={Boolean(errorFor("saveDirectory")) || undefined}
                  onChange={(e) => set("saveDirectory", e.target.value)}
                  className="font-mono"
                />
              </SettingRow>
              <SettingRow
                label="Log folder"
                htmlFor={`${id}-log-dir`}
                description="Where the server writes its log files."
                error={errorFor("logDirectory")}
                changed={changed("logDirectory")}
              >
                <Input
                  id={`${id}-log-dir`}
                  value={text(draft, "logDirectory")}
                  aria-invalid={Boolean(errorFor("logDirectory")) || undefined}
                  onChange={(e) => set("logDirectory", e.target.value)}
                  className="font-mono"
                />
              </SettingRow>
            </SettingList>
          </CollapsibleContent>
        </section>
      </Collapsible>
    </div>
  );
};
