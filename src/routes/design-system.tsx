import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  BoldIcon,
  CheckIcon,
  ChevronRightIcon,
  FlameIcon,
  InfoIcon,
  ItalicIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
  ServerIcon,
  TrashIcon,
  UnderlineIcon,
  UsersIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { FlameBeacon } from "@/components/brand/flame-beacon";
import { BrandBanner, LogoMark } from "@/components/brand/logo";
import { Page, PageHeader } from "@/components/layout/page";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, BadgeDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ---- helpers ------------------------------------------------------------ */

const Section = ({
  anchor,
  title,
  description,
  children,
}: {
  anchor: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section id={anchor} className="scroll-mt-20 space-y-4">
    <div>
      <h2 className="text-lg font-semibold tracking-[0.06em]">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {children}
  </section>
);

const Swatch = ({
  name,
  cssVar,
  className,
}: {
  name: string;
  cssVar: string;
  className: string;
}) => (
  <div className="space-y-1.5">
    <div className={`h-14 rounded-lg border ${className}`} />
    <p className="text-xs font-medium">{name}</p>
    <p className="font-mono text-[0.68rem] text-muted-foreground">{cssVar}</p>
  </div>
);

const TOKENS = [
  { name: "Background", cssVar: "--background", className: "bg-background" },
  { name: "Card", cssVar: "--card", className: "bg-card" },
  { name: "Popover", cssVar: "--popover", className: "bg-popover" },
  { name: "Muted", cssVar: "--muted", className: "bg-muted" },
  { name: "Secondary", cssVar: "--secondary", className: "bg-secondary" },
  { name: "Accent", cssVar: "--accent", className: "bg-accent" },
  { name: "Primary", cssVar: "--primary", className: "bg-primary" },
  { name: "Border", cssVar: "--border", className: "bg-border" },
  { name: "Ring", cssVar: "--ring", className: "bg-ring" },
  { name: "Sidebar", cssVar: "--sidebar", className: "bg-sidebar" },
  { name: "Foreground", cssVar: "--foreground", className: "bg-foreground" },
];

const BRAND_TOKENS = [
  {
    name: "Ember · fire",
    cssVar: "--ember",
    className: "bg-ember shadow-ember",
  },
  {
    name: "Shroud · mist",
    cssVar: "--shroud",
    className: "bg-shroud shadow-shroud",
  },
  { name: "Firelight", cssVar: "--firelight", className: "bg-firelight" },
  { name: "Stone · masonry", cssVar: "--stone", className: "bg-stone" },
  { name: "Success · verdant", cssVar: "--success", className: "bg-success" },
  { name: "Info · shroud", cssVar: "--info", className: "bg-info" },
  { name: "Warning · flame", cssVar: "--warning", className: "bg-warning" },
  {
    name: "Destructive · coals",
    cssVar: "--destructive",
    className: "bg-destructive",
  },
  {
    name: "Chart 1–5",
    cssVar: "--chart-*",
    className:
      "bg-linear-to-r from-chart-1 via-chart-2 via-chart-3 via-chart-4 to-chart-5",
  },
];

/* ---- page --------------------------------------------------------------- */

const DesignSystem = () => {
  const id = useId();
  const [progress] = useState(64);
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 10));

  return (
    <Page width="wide">
      <PageHeader
        title="Design System"
        description="Every shadcn component, themed dark-first for the void between the spires, with a sunlit parchment light theme."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast("The Flame flickers", {
                description: "Toasts use the Sonner component.",
              })
            }
          >
            Show toast
          </Button>
        }
      />

      <BrandBanner />

      <Section
        anchor="altar"
        title="The Flame altar"
        description="The server's state everywhere it's shown: lit while it runs, a small Shroud flame while it starts or stops, guttering when it stops answering, cold when it's off. Sizes sm (rail), lg (hero) and xl (full-window screens)."
      >
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          {(["lit", "kindling", "faltering", "out"] as const).map((state) => (
            <figure key={state} className="flex flex-col items-center gap-3">
              <div className="flex items-end gap-4">
                <FlameBeacon state={state} size="sm" />
                <FlameBeacon state={state} />
              </div>
              <figcaption className="font-mono text-xs text-muted-foreground">
                {state}
              </figcaption>
            </figure>
          ))}
          <FlameBeacon state="lit" size="xl" />
        </div>
      </Section>

      <Section
        anchor="colors"
        title="Colour tokens"
        description="Semantic tokens consumed by every component. Brand and status tokens are Tailwind colours too (bg-ember, text-shroud, border-success/40…)."
      >
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {TOKENS.map((t) => (
            <Swatch key={t.cssVar} {...t} />
          ))}
        </div>
        <Separator />
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-9">
          {BRAND_TOKENS.map((t) => (
            <Swatch key={t.cssVar} {...t} />
          ))}
        </div>
      </Section>

      <Section
        anchor="typography"
        title="Typography"
        description="Cinzel for headings and titles, Barlow for UI, JetBrains Mono for logs and code."
      >
        <Card>
          <CardContent className="space-y-4">
            <p className="font-display text-4xl font-bold tracking-[0.12em]">
              ENSHROUDED
            </p>
            <p className="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              Server Manager · Embervale
            </p>
            <p className="font-display text-xl font-semibold tracking-[0.03em]">
              Flame Altar · Revelwood
            </p>
            <p className="text-base">
              Body text uses Barlow. The quick brown fox jumps over the lazy dog
              while the Shroud creeps across the valley.
            </p>
            <p className="text-sm text-muted-foreground">
              Muted supporting text for descriptions and metadata.
            </p>
            <pre className="rounded-lg border bg-console p-3 font-mono text-xs">
              {
                "[21:42:08] INFO  Thalia placed a Flame Altar in Revelwood\n[21:40:51] WARN  Ilyra ping exceeded 100 ms"
              }
            </pre>
          </CardContent>
        </Card>
      </Section>

      <Section
        anchor="buttons"
        title="Buttons"
        description="Gold is the affirmative action and nothing else. If two gold buttons appear on one screen, one of them is wrong."
      >
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
              <Button className="shadow-ember">
                <FlameIcon data-icon="inline-start" />
                With ember glow
              </Button>
              <Button disabled>
                <Spinner data-icon="inline-start" />
                Starting
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Add">
                <PlusIcon />
              </Button>
              <Button size="icon-sm" variant="outline" aria-label="Delete">
                <TrashIcon />
              </Button>
              <ButtonGroup>
                <Button variant="outline">Start</Button>
                <Button variant="outline">Stop</Button>
                <Button variant="outline">Restart</Button>
              </ButtonGroup>
              <ToggleGroup
                type="multiple"
                variant="outline"
                defaultValue={["bold"]}
              >
                <ToggleGroupItem value="bold" aria-label="Bold">
                  <BoldIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="italic" aria-label="Italic">
                  <ItalicIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="underline" aria-label="Underline">
                  <UnderlineIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section
        anchor="badges"
        title="Badges & status"
        description="Status colours are semantic, not brand: verdant for healthy, shroud for in transition, flame for warning, coals for failure."
      >
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="ghost">Ghost</Badge>
          </CardContent>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <BadgeDot />
              Running
            </Badge>
            <Badge variant="neutral">
              <BadgeDot />
              Stopped
            </Badge>
            <Badge variant="info">
              <BadgeDot pulse />
              Starting
            </Badge>
            <Badge variant="info">
              <BadgeDot pulse />
              Updating
            </Badge>
            <Badge variant="warning">
              <BadgeDot />
              Needs attention
            </Badge>
            <Badge variant="error">
              <BadgeDot />
              Crashed
            </Badge>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </CardContent>
        </Card>
      </Section>

      <Section
        anchor="forms"
        title="Forms"
        description="Inputs, selects, choices and sliders inside Field groups."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Server settings</CardTitle>
              <CardDescription>
                Text inputs, groups and selects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${id}-name`}>Server name</FieldLabel>
                  <Input id={`${id}-name`} defaultValue="Embervale" />
                  <FieldDescription>
                    Shown in the in-game server browser.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-port`}>Query port</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <ServerIcon />
                    </InputGroupAddon>
                    <InputGroupInput id={`${id}-port`} defaultValue="15637" />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>UDP</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-search`}>Search</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <SearchIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id={`${id}-search`}
                      placeholder="Find a player…"
                    />
                    <InputGroupAddon align="inline-end">
                      <Kbd>/</Kbd>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-difficulty`}>
                    Difficulty preset
                  </FieldLabel>
                  <Select defaultValue="default">
                    <SelectTrigger id={`${id}-difficulty`} className="w-full">
                      <SelectValue placeholder="Choose a preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relaxed">Relaxed</SelectItem>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="survival">Survival</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-motd`}>
                    Message of the day
                  </FieldLabel>
                  <Textarea
                    id={`${id}-motd`}
                    placeholder="Welcome, Flameborn…"
                    rows={3}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-error`}>Password</FieldLabel>
                  <Input
                    id={`${id}-error`}
                    type="password"
                    defaultValue="hunter2"
                    aria-invalid
                  />
                  <FieldDescription className="text-destructive">
                    Must be at least 8 characters.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gameplay</CardTitle>
              <CardDescription>
                Checkboxes, radios, switches and sliders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <Field orientation="horizontal">
                    <Checkbox id={`${id}-pvp`} />
                    <FieldLabel htmlFor={`${id}-pvp`}>Enable PvP</FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <Checkbox id={`${id}-public`} defaultChecked />
                    <FieldLabel htmlFor={`${id}-public`}>
                      List in public server browser
                    </FieldLabel>
                  </Field>
                </FieldSet>
                <Field>
                  <FieldLabel>Day length</FieldLabel>
                  <RadioGroup defaultValue="normal" className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="short" id={`${id}-short`} />
                      <Label htmlFor={`${id}-short`}>Short</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="normal" id={`${id}-normal`} />
                      <Label htmlFor={`${id}-normal`}>Normal</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="long" id={`${id}-long`} />
                      <Label htmlFor={`${id}-long`}>Long</Label>
                    </div>
                  </RadioGroup>
                </Field>
                <Field orientation="horizontal">
                  <Switch id={`${id}-autosave`} defaultChecked />
                  <FieldLabel htmlFor={`${id}-autosave`}>
                    Autosave every 30 minutes
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Switch id={`${id}-tele`} />
                  <FieldLabel htmlFor={`${id}-tele`}>Send telemetry</FieldLabel>
                </Field>
                <Field>
                  <FieldLabel>Max players</FieldLabel>
                  <Slider defaultValue={[16]} max={16} step={1} />
                  <FieldDescription>
                    Up to 16 Flameborn per world.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Shroud damage multiplier</FieldLabel>
                  <Slider
                    defaultValue={[50]}
                    max={200}
                    step={5}
                    className="[&_[data-slot=slider-range]]:bg-shroud [&_[data-slot=slider-thumb]]:bg-shroud"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              <Button variant="ghost">Reset</Button>
              <Button>Save changes</Button>
            </CardFooter>
          </Card>
        </div>
      </Section>

      <Section
        anchor="feedback"
        title="Feedback"
        description="Alerts, progress and loading states."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Alert>
              <InfoIcon />
              <AlertTitle>Server update available</AlertTitle>
              <AlertDescription>
                Enshrouded 0.8.4 is ready to install. Players will be
                disconnected.
              </AlertDescription>
            </Alert>
            <Alert variant="success">
              <CheckIcon />
              <AlertTitle>Backup complete</AlertTitle>
              <AlertDescription>
                World saved to backups/embervale-184.zip
              </AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTriangleIcon />
              <AlertTitle>High memory usage</AlertTitle>
              <AlertDescription>
                The server is using 92% of its reserved memory.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>Server crashed</AlertTitle>
              <AlertDescription>
                Exit code 3. Check the console for details.
              </AlertDescription>
            </Alert>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Progress & loading</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span>Installing update</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
              <Progress value={37} tone="shroud" />
              <div className="grid grid-cols-3 gap-3">
                <Progress value={100} tone="success" />
                <Progress value={70} tone="warning" />
                <Progress value={45} tone="destructive" />
              </div>
              <div className="flex items-center gap-3">
                <Spinner />
                <Spinner className="size-6 text-ember" />
                <span className="text-sm text-muted-foreground">
                  Waiting for the server…
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        anchor="overlays"
        title="Overlays"
        description="Dialogs, sheets, popovers, menus and tooltips."
      >
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rename server</DialogTitle>
                  <DialogDescription>
                    Players will see the new name after the next restart.
                  </DialogDescription>
                </DialogHeader>
                <Field>
                  <FieldLabel htmlFor={`${id}-rename`}>Name</FieldLabel>
                  <Input id={`${id}-rename`} defaultValue="Embervale" />
                </Field>
                <DialogFooter>
                  <Button variant="ghost">Cancel</Button>
                  <Button>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Alert dialog</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete world “Embervale”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the save and all 184 backups. The Shroud
                    reclaims everything.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Player details</SheetTitle>
                  <SheetDescription>
                    Thalia · level 25 · Revelwood
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-3 px-4">
                  <Item variant="outline">
                    <ItemMedia>
                      <Avatar>
                        <AvatarFallback className="bg-ember/15 text-ember">
                          T
                        </AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Thalia</ItemTitle>
                      <ItemDescription>
                        Joined 2h 14m ago · 34 ms
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button size="sm" variant="outline">
                        Kick
                      </Button>
                    </ItemActions>
                  </Item>
                </div>
              </SheetContent>
            </Sheet>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Popover</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 space-y-2">
                <p className="text-sm font-medium">Quick actions</p>
                <p className="text-xs text-muted-foreground">
                  Broadcast a message to everyone online.
                </p>
                <Input placeholder="Message…" />
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Dropdown
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Server</DropdownMenuLabel>
                <DropdownMenuItem>Restart</DropdownMenuItem>
                <DropdownMenuItem>Update</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <TrashIcon />
                  Delete world
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="link">Hover card</Button>
              </HoverCardTrigger>
              <HoverCardContent className="flex items-center gap-3">
                <LogoMark variant="simple" className="size-10" />
                <div>
                  <p className="text-sm font-medium">
                    Enshrouded Server Manager
                  </p>
                  <p className="text-xs text-muted-foreground">
                    v0.1.0 · Tauri 2
                  </p>
                </div>
              </HoverCardContent>
            </HoverCard>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>
                Press <Kbd>R</Kbd> to restart
              </TooltipContent>
            </Tooltip>
          </CardContent>
          <CardContent className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-muted-foreground">Toasts</span>
            <ButtonGroup>
              <Button
                variant="outline"
                onClick={() =>
                  toast("Backup scheduled", {
                    description: "Embervale will be archived at 22:30.",
                    action: { label: "Back up now", onClick: () => {} },
                  })
                }
              >
                Default
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.success("SteamCMD downloaded")}
              >
                Success
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.info("Restart queued", {
                    description: "Players get a 60 second warning.",
                  })
                }
              >
                Info
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.warning("Stop requested", {
                    description: "Players will be warned.",
                  })
                }
              >
                Warning
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.error("Couldn't reach Steam", {
                    description: "Check your connection and try again.",
                  })
                }
              >
                Error
              </Button>
            </ButtonGroup>
          </CardContent>
        </Card>
      </Section>

      <Section
        anchor="navigation"
        title="Navigation & data"
        description="Tabs, tables, pagination, accordion and the calendar."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent>
              <Tabs defaultValue="players">
                <TabsList>
                  <TabsTrigger value="players">
                    <UsersIcon />
                    Players
                  </TabsTrigger>
                  <TabsTrigger value="bans">Bans</TabsTrigger>
                  <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
                </TabsList>
                <TabsContent value="players" className="pt-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead className="text-right">Ping</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ["Thalia", 25, 34],
                        ["Brannoc", 21, 58],
                        ["Ilyra", 19, 112],
                      ].map(([name, level, ping]) => (
                        <TableRow key={String(name)}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>{level}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {ping} ms
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Pagination className="pt-3">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#" isActive>
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#">2</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext href="#" />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </TabsContent>
                <TabsContent
                  value="bans"
                  className="pt-3 text-sm text-muted-foreground"
                >
                  No banned players.
                </TabsContent>
                <TabsContent
                  value="whitelist"
                  className="pt-3 text-sm text-muted-foreground"
                >
                  Whitelist is disabled.
                </TabsContent>
              </Tabs>
              <Separator className="my-4" />
              <Tabs defaultValue="general">
                <TabsList variant="line">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="world">World</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="flame">
                  <AccordionItem value="flame">
                    <AccordionTrigger>What is the Flame?</AccordionTrigger>
                    <AccordionContent>
                      The Flame Altar is the heart of every base. Strengthening
                      it lets players push deeper into the Shroud.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="shroud">
                    <AccordionTrigger>What is the Shroud?</AccordionTrigger>
                    <AccordionContent>
                      A toxic mist that covers Embervale. Time spent inside is
                      limited by the Flame's strength.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="backups">
                    <AccordionTrigger>
                      How often are backups made?
                    </AccordionTrigger>
                    <AccordionContent>
                      Every hour by default, configurable under Backups.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-wrap items-start gap-6">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-md border"
                />
                <div className="space-y-3">
                  <div className="flex -space-x-2">
                    {["T", "B", "I", "K"].map((initial) => (
                      <Avatar key={initial} className="ring-2 ring-card">
                        <AvatarFallback className="bg-shroud/15 text-shroud">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <Item variant="muted" size="sm">
                    <ItemMedia variant="icon">
                      <MailIcon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Weekly report</ItemTitle>
                      <ItemDescription>
                        Sent every Monday at 08:00
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Switch defaultChecked />
                    </ItemActions>
                  </Item>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>
    </Page>
  );
};

export const Route = createFileRoute("/design-system")({
  component: DesignSystem,
});
