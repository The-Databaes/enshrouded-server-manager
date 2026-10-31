import { cn } from "cn";
import { format } from "date-fns";
import {
  CopyIcon,
  CrownIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldBanIcon,
  ShieldOffIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ListNotice } from "@/components/dashboard/online-players";
import { Section } from "@/components/layout/page";
import { PlayerAvatar } from "@/components/player-avatar";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Everything allowed reads as an admin; nothing as a visitor. */
const roleIcon = (role: Role) => {
  const granted = PERMISSIONS.filter((p) => role[p.key] === true).length;
  if (granted === PERMISSIONS.length) return CrownIcon;
  return UserRoundIcon;
};

const PasswordCell = ({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
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
  const iconButton =
    "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-40 [&_svg]:size-3.5";
  return (
    <div className="flex h-8 items-center gap-0.5 rounded-lg border border-input bg-background/40 pr-1 pl-2.5 transition-shadow focus-within:border-ring focus-within:shadow-focus">
      <input
        type={shown ? "text" : "password"}
        size={1}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder="No password"
        className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted-foreground/70"
      />
      <button
        type="button"
        className={iconButton}
        aria-label={shown ? "Hide password" : "Show password"}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </button>
      <button
        type="button"
        className={iconButton}
        aria-label="Copy password"
        disabled={!value}
        onClick={() => void copy()}
      >
        <CopyIcon />
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={iconButton}
            aria-label="Generate a new password"
            onClick={() => {
              onChange(generatePassword());
              setShown(true);
            }}
          >
            <RefreshCwIcon />
          </button>
        </TooltipTrigger>
        <TooltipContent>New random password</TooltipContent>
      </Tooltip>
    </div>
  );
};

/** The left column of the matrix: what a row means. */
const RowHead = ({
  label,
  description,
  icon: Icon,
}: {
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) => (
  <th
    scope="row"
    className="sticky left-0 z-[1] py-3.5 pr-6 text-left align-middle font-normal transition-colors group-data-scrolled/matrix:bg-background/95 group-data-scrolled/matrix:shadow-[10px_0_14px_-12px_oklch(0_0_0/70%)] group-data-scrolled/matrix:backdrop-blur-sm"
  >
    <p className="flex items-center gap-2 text-sm font-medium">
      {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
      {label}
    </p>
    {description ? (
      <p className="mt-0.5 max-w-[13rem] text-[0.75rem] leading-snug text-pretty text-muted-foreground">
        {description}
      </p>
    ) : null}
  </th>
);

const CELL = "border-l border-border/45 px-3.5 py-3.5 align-middle";

type RolesTabProps = {
  draft: SettingsDoc;
  problems: Problem[];
  onChange: Update;
};

/** Roles (passwords and what each may do) as one matrix, and bans. */
export const RolesTab = ({ draft, problems, onChange }: RolesTabProps) => {
  const roles = roleEntries(draft);
  const bans = bansOf(draft);
  const [removing, setRemoving] = useState<number | null>(null);
  // The label column only needs a backdrop once the roles slide under it.
  const [scrolled, setScrolled] = useState(false);
  const takenNames = new Set(
    roles.map(({ role }) => str(role.name).toLowerCase()),
  );
  const freeName = (base: string) => {
    let name = base;
    for (let n = 2; takenNames.has(name.toLowerCase()); n++)
      name = `${base} ${n}`;
    return name;
  };
  const slotProblem = problems.find((p) => p.field === "userGroups");
  const patch = (index: number, change: Record<string, unknown>) =>
    onChange((doc) => updateRole(doc, index, change));
  // Permissions a newer server added: shown as plain rows.
  const extraPermissions = [
    ...new Set(
      roles.flatMap(({ role }) =>
        Object.keys(role).filter(
          (k) => !KNOWN_ROLE_KEYS.has(k) && typeof role[k] === "boolean",
        ),
      ),
    ),
  ];
  const permissionRows = [
    ...PERMISSIONS,
    ...extraPermissions.map((key) => ({
      key,
      label: humanize(key),
      description: "Added by a newer server version.",
    })),
  ];
  const removingRole =
    removing === null ? null : roles.find((r) => r.index === removing);

  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <PlusIcon data-icon="inline-start" />
          Add role
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
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
  );

  return (
    <div className="space-y-14">
      <Section
        title="Roles"
        description="Players join by entering a role's password; the role decides what they may do. Everyone can explore, fight and gather outside bases."
        actions={addMenu}
      >
        {roles.length === 0 || slotProblem ? (
          <Alert variant="warning" className="mb-5">
            <TriangleAlertIcon />
            <AlertDescription>
              {roles.length === 0
                ? 'There are no roles. The server creates a "Default" role with a random password when it starts.'
                : slotProblem?.message}
            </AlertDescription>
          </Alert>
        ) : null}

        {roles.length ? (
          <div
            data-scrolled={scrolled || undefined}
            onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
            className="group/matrix -mx-1 overflow-x-auto px-1 pb-2"
          >
            <table className="w-full min-w-max border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] w-[14rem] group-data-scrolled/matrix:bg-background/95 group-data-scrolled/matrix:backdrop-blur-sm" />
                  {roles.map(({ role, index }) => {
                    const Icon = roleIcon(role);
                    const roleProblems = problems.filter(
                      (p) => p.field === `role:${index}`,
                    );
                    return (
                      <th
                        key={index}
                        scope="col"
                        className="min-w-[11.5rem] border-b border-l border-border/45 px-3.5 pb-4 text-left align-bottom font-normal"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border bg-foreground/[0.03] text-shroud">
                            <Icon className="size-3.5" />
                          </span>
                          <input
                            size={1}
                            value={str(role.name)}
                            aria-label="Role name"
                            placeholder="Unnamed role"
                            onChange={(e) =>
                              patch(index, { name: e.target.value })
                            }
                            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-display text-[0.95rem] font-semibold tracking-[0.04em] outline-none transition-colors hover:border-border focus:border-ring focus:shadow-focus"
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground"
                                aria-label={`More for ${str(role.name) || "this role"}`}
                              >
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  patch(index, { password: generatePassword() })
                                }
                              >
                                <RefreshCwIcon />
                                New random password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setRemoving(index)}
                              >
                                <Trash2Icon />
                                Remove role
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {roleProblems.length ? (
                          <ul className="mt-2 space-y-0.5">
                            {roleProblems.map((p) => (
                              <li
                                key={p.message}
                                className={cn(
                                  "text-[0.72rem] leading-snug",
                                  p.blocking
                                    ? "text-destructive"
                                    : "text-warning",
                                )}
                              >
                                {p.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="[&>tr>*]:border-b [&>tr>*]:border-border/45 [&>tr:last-child>*]:border-b-0 [&>tr:hover>td]:bg-foreground/[0.015]">
                <tr>
                  <RowHead
                    label="Password"
                    icon={KeyRoundIcon}
                    description="What players type to join as this role."
                  />
                  {roles.map(({ role, index }) => (
                    <td key={index} className={CELL}>
                      <PasswordCell
                        value={str(role.password)}
                        label={`Password for ${str(role.name) || "this role"}`}
                        onChange={(v) => patch(index, { password: v })}
                      />
                    </td>
                  ))}
                </tr>
                {permissionRows.map((permission) => (
                  <tr key={permission.key}>
                    <RowHead
                      label={permission.label}
                      description={permission.description}
                    />
                    {roles.map(({ role, index }) => (
                      <td key={index} className={CELL}>
                        <Switch
                          checked={role[permission.key] === true}
                          aria-label={`${permission.label} for ${str(role.name) || "this role"}`}
                          onCheckedChange={(on) =>
                            patch(index, { [permission.key]: on })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <RowHead
                    label="Reserved slots"
                    description="Kept free for this role, so its players can join a busy server."
                  />
                  {roles.map(({ role, index }) => (
                    <td key={index} className={CELL}>
                      <input
                        type="number"
                        min={0}
                        max={SLOT_LIMIT}
                        aria-label={`Reserved slots for ${str(role.name) || "this role"}`}
                        value={
                          typeof role.reservedSlots === "number"
                            ? role.reservedSlots
                            : 0
                        }
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          patch(index, {
                            reservedSlots: Number.isFinite(n)
                              ? Math.min(SLOT_LIMIT, Math.max(0, n))
                              : 0,
                          });
                        }}
                        className="h-8 w-20 rounded-lg border border-input bg-background/40 px-2.5 text-sm tabular-nums outline-none focus:border-ring focus:shadow-focus"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      <Section
        title="Banned players"
        description="Players are banned in game, from the Social tab. A lifted ban is saved with your other changes and takes effect when the server next starts."
        rule
      >
        {bans.length === 0 ? (
          <ListNotice icon={ShieldBanIcon}>Nobody is banned.</ListNotice>
        ) : (
          <ul className="divide-y divide-border/55 border-y border-border/55">
            {bans.map((ban) => (
              <li
                key={ban.accountIdHash}
                className="flex items-center gap-4 py-3"
              >
                <PlayerAvatar
                  name={ban.displayName ?? null}
                  seed={ban.accountIdHash}
                  className="grayscale"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {ban.displayName || "Unknown player"}
                    {ban.characterName ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        as {ban.characterName}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {typeof ban.banDate === "number"
                      ? `Banned on ${format(ban.banDate * 1000, "d MMMM yyyy")}`
                      : "Ban date unknown"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onChange((doc) => removeBan(doc, ban.accountIdHash))
                  }
                >
                  <ShieldOffIcon data-icon="inline-start" />
                  Lift ban
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AlertDialog
        open={removingRole !== null && removingRole !== undefined}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove the {str(removingRole?.role.name) || "unnamed"} role?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Its password stops working when the server next starts, so players
              who use it will need another role's password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing !== null)
                  onChange((doc) => removeRole(doc, removing));
                setRemoving(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
