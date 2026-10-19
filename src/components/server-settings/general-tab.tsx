import { cn } from "cn";
import { ChevronDownIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const FieldRow = ({
  label,
  htmlFor,
  description,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  description?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="grid gap-x-6 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-center">
    <div className="space-y-0.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {description ? (
        <p className="text-xs text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
    <div className="space-y-1">
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  </div>
);

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

type GeneralTabProps = {
  draft: SettingsDoc;
  problems: Problem[];
  onChange: Update;
};

/** Name, slots, server-list tags, chat, and network/folders. */
export const GeneralTab = ({ draft, problems, onChange }: GeneralTabProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const id = useId();
  const errorFor = (field: string) =>
    problems.find((p) => p.field === field && p.blocking)?.message;
  const set = (key: string, value: unknown) =>
    onChange((doc) => setTopLevel(doc, key, value));

  const tags = Array.isArray(draft.tags)
    ? draft.tags.filter((t): t is string => typeof t === "string")
    : [];
  const unknownTags = tags.filter((t) => !KNOWN_TAGS.has(t));
  const slots = typeof draft.slotCount === "number" ? draft.slotCount : 16;
  const voice = draft.enableVoiceChat === true;
  const advancedError = [
    "ip",
    "queryPort",
    "saveDirectory",
    "logDirectory",
  ].some((f) => errorFor(f));

  const removeTag = (tag: string) =>
    set(
      "tags",
      tags.filter((t) => t !== tag),
    );

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Server listing</CardTitle>
          <CardDescription>
            How the server appears in the game's server list.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          <FieldRow
            label="Server name"
            htmlFor={`${id}-server-name`}
            description="What players search for. Please keep it friendly."
            error={errorFor("name")}
          >
            <Input
              id={`${id}-server-name`}
              value={text(draft, "name")}
              maxLength={64}
              aria-invalid={Boolean(errorFor("name")) || undefined}
              onChange={(e) => set("name", e.target.value)}
            />
          </FieldRow>
          <FieldRow
            label="Player slots"
            htmlFor={`${id}-slot-count`}
            description={`How many players can be on at once, up to ${SLOT_LIMIT}.`}
            error={errorFor("slotCount")}
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
                className="h-8 w-16 text-right"
              />
            </div>
          </FieldRow>
          <div className="space-y-3 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Tags</p>
              <p className="text-xs text-muted-foreground">
                Help players find a server that suits them: they can filter the
                list by these.
              </p>
            </div>
            {TAG_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.title}
                </p>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  size="sm"
                  spacing={1}
                  value={tags}
                  // `value` holds every tag, so the new list includes the
                  // other groups' tags (and unknown ones) unchanged.
                  onValueChange={(next) => set("tags", next)}
                  className="flex-wrap justify-start"
                >
                  {group.tags.map((tag) => (
                    <ToggleGroupItem
                      key={tag.value}
                      value={tag.value}
                      className="data-[state=on]:border-ember/50 data-[state=on]:bg-ember/12 data-[state=on]:text-ember"
                    >
                      {tag.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
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
                      <Badge key={tag} variant="warning" className="gap-1 pr-1">
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove tag ${tag}`}
                          onClick={() => removeTag(tag)}
                          className="rounded-sm p-0.5 hover:bg-warning/20"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>Both are off on a new server.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          <FieldRow
            label="Text chat"
            htmlFor={`${id}-text-chat`}
            description="Players can type messages to each other."
          >
            <div className="flex items-center gap-2">
              <Switch
                id={`${id}-text-chat`}
                checked={draft.enableTextChat === true}
                onCheckedChange={(on) => set("enableTextChat", on)}
              />
              <span className="text-sm text-muted-foreground">
                {draft.enableTextChat === true ? "On" : "Off"}
              </span>
            </div>
          </FieldRow>
          <FieldRow
            label="Voice chat"
            htmlFor={`${id}-voice-chat`}
            description="Players can talk over their microphones."
          >
            <div className="flex items-center gap-2">
              <Switch
                id={`${id}-voice-chat`}
                checked={voice}
                onCheckedChange={(on) => set("enableVoiceChat", on)}
              />
              <span className="text-sm text-muted-foreground">
                {voice ? "On" : "Off"}
              </span>
            </div>
          </FieldRow>
          <FieldRow
            label="Who you hear"
            description={
              voice
                ? "Proximity is like talking in person; Global is a group call."
                : "Turn voice chat on to choose."
            }
          >
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              disabled={!voice}
              value={text(draft, "voiceChatMode") || "Proximity"}
              onValueChange={(v) => v && set("voiceChatMode", v)}
              aria-label="Voice chat mode"
              className="w-full"
            >
              {VOICE_CHAT_MODES.map((mode) => (
                <ToggleGroupItem
                  key={mode.value}
                  value={mode.value}
                  className="flex-1 data-[state=on]:border-ember/50 data-[state=on]:bg-ember/12 data-[state=on]:text-ember"
                >
                  {mode.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldRow>
        </CardContent>
      </Card>

      <Collapsible
        open={advancedOpen || advancedError}
        onOpenChange={setAdvancedOpen}
      >
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left outline-none"
              >
                <div className="space-y-1.5">
                  <CardTitle>Network and folders</CardTitle>
                  <CardDescription>
                    Advanced. The defaults suit almost every server.
                  </CardDescription>
                </div>
                <ChevronDownIcon
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    (advancedOpen || advancedError) && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="divide-y divide-border/60">
              <FieldRow
                label="Query port"
                htmlFor={`${id}-query-port`}
                description="The UDP port players connect on. To let players in from the internet, forward it on your router."
                error={errorFor("queryPort")}
              >
                <IntegerInput
                  id={`${id}-query-port`}
                  value={draft.queryPort}
                  invalid={Boolean(errorFor("queryPort"))}
                  onChange={(v) => set("queryPort", v)}
                />
              </FieldRow>
              <FieldRow
                label="Listen address"
                htmlFor={`${id}-listen-ip`}
                description="0.0.0.0 listens on every network adapter. Only change this to tie the server to one adapter."
                error={errorFor("ip")}
              >
                <Input
                  id={`${id}-listen-ip`}
                  value={text(draft, "ip")}
                  aria-invalid={Boolean(errorFor("ip")) || undefined}
                  onChange={(e) => set("ip", e.target.value)}
                  className="font-mono"
                />
              </FieldRow>
              <FieldRow
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
              >
                <Input
                  id={`${id}-save-dir`}
                  value={text(draft, "saveDirectory")}
                  aria-invalid={Boolean(errorFor("saveDirectory")) || undefined}
                  onChange={(e) => set("saveDirectory", e.target.value)}
                  className="font-mono"
                />
              </FieldRow>
              <FieldRow
                label="Log folder"
                htmlFor={`${id}-log-dir`}
                description="Where the server writes its log files."
                error={errorFor("logDirectory")}
              >
                <Input
                  id={`${id}-log-dir`}
                  value={text(draft, "logDirectory")}
                  aria-invalid={Boolean(errorFor("logDirectory")) || undefined}
                  onChange={(e) => set("logDirectory", e.target.value)}
                  className="font-mono"
                />
              </FieldRow>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
