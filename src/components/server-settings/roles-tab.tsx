import { format } from "date-fns";
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldBanIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  addRole,
  bansOf,
  type Problem,
  type Role,
  removeBan,
  removeRole,
  roleEntries,
  type SettingsDoc,
  updateRole,
} from "@/lib/server/settings-editor";
import {
  generatePassword,
  PERMISSIONS,
  ROLE_TEMPLATES,
  roleFromTemplate,
  SLOT_LIMIT,
} from "@/lib/server/settings-schema";

type Update = (update: (doc: SettingsDoc) => SettingsDoc) => void;

const KNOWN_ROLE_KEYS = new Set([
  "name",
  "password",
  "reservedSlots",
  ...PERMISSIONS.map((p) => p.key),
]);

/** Readable label for a permission this version doesn't know. */
const humanize = (key: string) =>
  key
    .replace(/^can/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

const PasswordField = ({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const [shown, setShown] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Password copied");
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={shown ? "Hide password" : "Show password"}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
        <InputGroupButton
          size="icon-xs"
          aria-label="Copy password"
          disabled={!value}
          onClick={() => void copy()}
        >
          <CopyIcon />
        </InputGroupButton>
        <InputGroupButton
          size="icon-xs"
          aria-label="Generate a new password"
          onClick={() => {
            onChange(generatePassword());
            setShown(true);
          }}
        >
          <RefreshCwIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
};

const RoleCard = ({
  role,
  index,
  problems,
  slotCount,
  onChange,
  onRemove,
}: {
  role: Role;
  index: number;
  problems: Problem[];
  slotCount: number;
  onChange: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) => {
  const name = typeof role.name === "string" ? role.name : "";
  const password = typeof role.password === "string" ? role.password : "";
  const reserved =
    typeof role.reservedSlots === "number" ? role.reservedSlots : 0;
  // Permissions a newer server added: shown as plain switches.
  const extraPermissions = Object.keys(role).filter(
    (k) => !KNOWN_ROLE_KEYS.has(k) && typeof role[k] === "boolean",
  );
  const id = `role-${index}`;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundCheckIcon className="size-4 text-shroud" />
          {name.trim() || "Unnamed role"}
        </CardTitle>
        <CardAction>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                aria-label={`Remove role ${name}`}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Remove the {name || "unnamed"} role?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Its password stops working when the server next starts, so
                  players who use it will need another role's password.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onRemove}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-password`}>Password</Label>
            <PasswordField
              id={`${id}-password`}
              value={password}
              onChange={(v) => onChange({ password: v })}
            />
          </div>
        </div>

        {problems.length ? (
          <ul className="space-y-1">
            {problems.map((p) => (
              <li
                key={p.message}
                className={
                  p.blocking
                    ? "text-xs text-destructive"
                    : "text-xs text-warning"
                }
              >
                {p.message}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[
            ...PERMISSIONS,
            ...extraPermissions.map((key) => ({
              key,
              label: humanize(key),
              description: "Added by a newer server version.",
            })),
          ].map((permission) => (
            <div key={permission.key} className="flex items-start gap-3">
              <Switch
                id={`${id}-${permission.key}`}
                checked={role[permission.key] === true}
                onCheckedChange={(on) => onChange({ [permission.key]: on })}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor={`${id}-${permission.key}`}
                  className="text-sm font-medium"
                >
                  {permission.label}
                </Label>
                <p className="text-xs text-pretty text-muted-foreground">
                  {permission.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <Label htmlFor={`${id}-reserved`} className="text-sm font-medium">
            Reserved slots
          </Label>
          <Input
            id={`${id}-reserved`}
            type="number"
            min={0}
            max={slotCount}
            value={reserved}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              onChange({
                reservedSlots: Number.isFinite(n)
                  ? Math.min(SLOT_LIMIT, Math.max(0, n))
                  : 0,
              });
            }}
            className="h-8 w-20 tabular-nums"
          />
          <p className="min-w-48 flex-1 text-xs text-muted-foreground">
            Slots kept free for this role, so its players can join a busy
            server.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

type RolesTabProps = {
  draft: SettingsDoc;
  problems: Problem[];
  onChange: Update;
};

/** Roles (passwords and what each may do) and banned players. */
export const RolesTab = ({ draft, problems, onChange }: RolesTabProps) => {
  const roles = roleEntries(draft);
  const bans = bansOf(draft);
  const slotCount = typeof draft.slotCount === "number" ? draft.slotCount : 16;
  const takenNames = new Set(
    roles.map(({ role }) =>
      typeof role.name === "string" ? role.name.toLowerCase() : "",
    ),
  );
  const freeName = (base: string) => {
    let name = base;
    for (let n = 2; takenNames.has(name.toLowerCase()); n++)
      name = `${base} ${n}`;
    return name;
  };
  const slotProblem = problems.find((p) => p.field === "userGroups");

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription className="text-pretty">
            Players join by entering a role's password; the role decides what
            they may do. Everyone can explore, fight and gather outside bases
            (Visitors can't change the world).
          </CardDescription>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <PlusIcon data-icon="inline-start" />
                  Add role
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Start from</DropdownMenuLabel>
                {ROLE_TEMPLATES.map((template) => (
                  <DropdownMenuItem
                    key={template.name}
                    onSelect={() =>
                      onChange((doc) =>
                        addRole(
                          doc,
                          roleFromTemplate(template, freeName(template.name)),
                        ),
                      )
                    }
                    className="flex-col items-start gap-0"
                  >
                    <span className="font-medium">{template.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {template.description}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    onChange((doc) =>
                      addRole(
                        doc,
                        roleFromTemplate(
                          ROLE_TEMPLATES[ROLE_TEMPLATES.length - 1],
                          freeName("New role"),
                        ),
                      ),
                    )
                  }
                >
                  Blank (no permissions)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        {roles.length === 0 || slotProblem ? (
          <CardContent>
            <Alert variant="warning">
              <TriangleAlertIcon />
              <AlertDescription>
                {roles.length === 0
                  ? 'There are no roles. The server creates a "Default" role with a random password when it starts.'
                  : slotProblem?.message}
              </AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {roles.map(({ role, index }) => (
          <RoleCard
            // Roles have no stable id; their position in the file is it.
            key={index}
            role={role}
            index={index}
            slotCount={slotCount}
            problems={problems.filter((p) => p.field === `role:${index}`)}
            onChange={(patch) =>
              onChange((doc) => updateRole(doc, index, patch))
            }
            onRemove={() => onChange((doc) => removeRole(doc, index))}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldBanIcon className="size-4 text-destructive" />
            Banned players
          </CardTitle>
          <CardDescription>
            Players are banned in game, from the Social tab. Lifting a ban here
            takes effect when the server next starts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bans.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nobody is banned.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {bans.map((ban) => (
                <li
                  key={ban.accountIdHash}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {ban.displayName || "Unknown player"}
                      {ban.characterName ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {ban.characterName}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeof ban.banDate === "number"
                        ? `Banned ${format(ban.banDate * 1000, "d MMM yyyy")}`
                        : "Ban date unknown"}
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onChange((doc) => removeBan(doc, ban.accountIdHash))
                        }
                      >
                        Lift ban
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Applies once you save</TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
