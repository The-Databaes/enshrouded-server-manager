import { cn } from "cn";

/*
 * Page layout without boxes. Structure comes from type, spacing and fading
 * hairlines; surfaces are kept for things that really are objects (the
 * console, dialogs, the save dock).
 */

type PageProps = React.ComponentProps<"div"> & {
  /** `narrow` for forms and reading, `wide` for dashboards, `full` to fill. */
  width?: "narrow" | "default" | "wide" | "full";
};

const WIDTHS = {
  narrow: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

/** One screen of the app: centred column that fades in on arrival. */
export const Page = ({
  width = "default",
  className,
  children,
  ...props
}: PageProps) => (
  <div
    className={cn(
      "mx-auto flex w-full animate-page-in flex-col gap-12 px-6 pt-8 pb-20 lg:px-10",
      WIDTHS[width],
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

type PageHeaderProps = {
  title: React.ReactNode;
  /** Small caps line above the title (context, e.g. the server's name). */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** The page's masthead: eyebrow, Cinzel title, a line of context, actions. */
export const PageHeader = ({
  title,
  eyebrow,
  description,
  actions,
  className,
}: PageHeaderProps) => (
  <header
    className={cn(
      "flex flex-wrap items-end justify-between gap-x-8 gap-y-4",
      className,
    )}
  >
    <div className="min-w-0 space-y-2">
      {eyebrow ? (
        <div className="eyebrow flex items-center gap-2">{eyebrow}</div>
      ) : null}
      <h1 className="text-[1.85rem] leading-tight font-semibold tracking-[0.04em] text-balance">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    ) : null}
  </header>
);

type SectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Controls on the right of the heading. */
  actions?: React.ReactNode;
  /**
   * `stacked` puts the heading above the content; `split` puts it in a
   * column on the left, for settings pages.
   */
  layout?: "stacked" | "split";
  /** Draw the fading rule above the section. */
  rule?: boolean;
};

/** A titled part of a page, divided from its neighbours by a hairline. */
export const Section = ({
  title,
  description,
  actions,
  layout = "stacked",
  rule = false,
  className,
  children,
  ...props
}: SectionProps) => (
  <section
    className={cn(
      "scroll-mt-6",
      layout === "split"
        ? "grid gap-x-12 gap-y-5 lg:grid-cols-[15rem_minmax(0,1fr)]"
        : "grid gap-5",
      rule && "relative pt-10",
      className,
    )}
    {...props}
  >
    {rule ? (
      <div aria-hidden="true" className="hairline absolute inset-x-0 top-0" />
    ) : null}
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        layout === "split" && "lg:flex-col lg:justify-start",
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h2 className="text-[1.05rem] leading-snug font-semibold tracking-[0.06em]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-[0.84rem] text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
    <div className="min-w-0">{children}</div>
  </section>
);

type SettingRowProps = {
  label: React.ReactNode;
  htmlFor?: string;
  description?: React.ReactNode;
  /** Shown under the control in the destructive colour. */
  error?: string | null;
  /** Something next to the label (a "changed" marker, a badge). */
  adornment?: React.ReactNode;
  /** Mark the row as edited but not saved. */
  changed?: boolean;
  /** Greyed out because another setting makes it moot. */
  inactive?: boolean;
  /** Width of the control column. */
  control?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
};

const CONTROL_WIDTHS = {
  sm: "md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]",
  md: "md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]",
  lg: "md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]",
} as const;

/**
 * One setting: what it is on the left, how to change it on the right. Rows
 * sit in a `<SettingList>`, which draws the hairlines between them.
 */
export const SettingRow = ({
  label,
  htmlFor,
  description,
  error,
  adornment,
  changed = false,
  inactive = false,
  control = "md",
  className,
  children,
}: SettingRowProps) => (
  <div
    data-changed={changed || undefined}
    className={cn(
      "relative grid gap-x-8 gap-y-2.5 py-4 md:items-center",
      CONTROL_WIDTHS[control],
      // An ember tick in the gutter marks unsaved edits.
      "before:absolute before:top-4 before:bottom-4 before:-left-4 before:w-0.5 before:rounded-full before:bg-ember before:opacity-0 before:shadow-[0_0_8px_var(--ember)] before:transition-opacity data-changed:before:opacity-100",
      inactive && "opacity-55",
      className,
    )}
  >
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={htmlFor}
          className="text-sm leading-snug font-medium text-foreground"
        >
          {label}
        </label>
        {adornment}
      </div>
      {description ? (
        <div className="text-[0.8rem] text-pretty text-muted-foreground">
          {description}
        </div>
      ) : null}
    </div>
    <div className="min-w-0 space-y-1.5">
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  </div>
);

/** A run of `<SettingRow>`s with hairlines between them. */
export const SettingList = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "divide-y divide-border/55 border-t border-border/55",
      className,
    )}
    {...props}
  />
);

/** A spec sheet: small caps labels over large values, in a flowing grid. */
export const Facts = ({ className, ...props }: React.ComponentProps<"dl">) => (
  <dl
    className={cn(
      "grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-10 gap-y-7",
      className,
    )}
    {...props}
  />
);

export const Fact = ({
  label,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn("min-w-0 space-y-1.5", className)}>
    <dt className="eyebrow">{label}</dt>
    <dd className="truncate text-[1.05rem] font-medium tabular-nums">
      {children}
    </dd>
    {hint ? (
      <dd className="truncate text-xs text-muted-foreground">{hint}</dd>
    ) : null}
  </div>
);

/** Label → value rows divided by hairlines, for details beside other content. */
export const DetailList = ({
  className,
  ...props
}: React.ComponentProps<"dl">) => (
  <dl
    className={cn("divide-y divide-border/55 text-sm", className)}
    {...props}
  />
);

export const Detail = ({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="flex min-h-11 items-center justify-between gap-4 py-2">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="flex min-w-0 items-center justify-end gap-1.5 text-right">
      {children}
    </dd>
  </div>
);

/** A muted em dash for values that aren't known. */
export const Unknown = ({ children = "—" }: { children?: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);
