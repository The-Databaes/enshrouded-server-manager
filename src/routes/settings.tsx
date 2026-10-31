import { createFileRoute } from "@tanstack/react-router";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { cn } from "cn";
import { MonitorIcon, MoonStarIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { RevealButton } from "@/components/dashboard/server-details";
import {
  Detail,
  DetailList,
  Page,
  PageHeader,
  Section,
} from "@/components/layout/page";
import { SteamCmdSettings } from "@/components/steamcmd/steamcmd-settings-card";
import { Kbd } from "@/components/ui/kbd";
import { useSteamCmd } from "@/hooks/use-steamcmd";

const THEMES = [
  {
    value: "dark",
    label: "Shroud",
    hint: "Dark",
    icon: MoonStarIcon,
    swatch: ["#0C0916", "#150F26", "#E8A33D", "#A97BE8"],
  },
  {
    value: "light",
    label: "Embervale",
    hint: "Light",
    icon: SunIcon,
    swatch: ["#F1EADD", "#F8F2E8", "#A2620F", "#7B4FD1"],
  },
  {
    value: "system",
    label: "Match Windows",
    hint: "System",
    icon: MonitorIcon,
    swatch: ["#0C0916", "#F1EADD", "#E8A33D", "#7B4FD1"],
  },
] as const;

/** A miniature of the app in the theme's colours. */
const ThemePreview = ({ swatch }: { swatch: readonly string[] }) => {
  const [field, raised, gold, mist] = swatch;
  return (
    <div
      aria-hidden="true"
      className="flex h-20 overflow-hidden rounded-lg border"
      style={{ background: field }}
    >
      <div
        className="w-1/4 border-r border-black/10"
        style={{ background: raised }}
      >
        <div
          className="mx-2 mt-3 h-1.5 rounded-full"
          style={{ background: gold, opacity: 0.9 }}
        />
        <div
          className="mx-2 mt-1.5 h-1 rounded-full"
          style={{ background: mist, opacity: 0.5 }}
        />
        <div
          className="mx-2 mt-1.5 h-1 rounded-full"
          style={{ background: mist, opacity: 0.5 }}
        />
      </div>
      <div className="flex-1 space-y-2 p-3">
        <div className="h-2 w-1/2 rounded-full" style={{ background: gold }} />
        <div
          className="h-1.5 w-3/4 rounded-full"
          style={{ background: mist, opacity: 0.45 }}
        />
        <div
          className="h-1.5 w-2/3 rounded-full"
          style={{ background: mist, opacity: 0.3 }}
        />
      </div>
    </div>
  );
};

const Appearance = () => {
  const { theme, setTheme } = useTheme();
  // The theme is only known on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <RadioGroupPrimitive.Root
      aria-label="Theme"
      value={mounted ? theme : undefined}
      onValueChange={setTheme}
      className="grid gap-4 sm:grid-cols-3"
    >
      {THEMES.map((t) => {
        const active = mounted && theme === t.value;
        return (
          <RadioGroupPrimitive.Item
            key={t.value}
            value={t.value}
            className={cn(
              "group space-y-3 rounded-xl border p-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              active
                ? "border-ember/60 shadow-[0_0_24px_-12px_var(--ember)]"
                : "border-border/80 hover:border-foreground/25",
            )}
          >
            <ThemePreview swatch={t.swatch} />
            <span className="flex items-center gap-2 px-1">
              <t.icon
                className={cn(
                  "size-4",
                  active ? "text-ember" : "text-muted-foreground",
                )}
              />
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {t.hint}
              </span>
            </span>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
};

const SHORTCUTS: [string, string][] = [
  ["Ctrl K", "Search and run commands"],
  ["Ctrl B", "Collapse or expand the sidebar"],
  ["Ctrl S", "Save server settings"],
];

const About = () => {
  const { status } = useSteamCmd();
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (isTauri())
      void getVersion()
        .then(setVersion)
        .catch(() => {});
  }, []);
  // SteamCMD's managed folder sits inside the app's data folder.
  const dataDir =
    status?.managedDir.replace(/[\\/]steamcmd[\\/]?$/, "") ?? null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <LogoMark className="size-14 rounded-[22%] shadow-ember" />
        <div>
          <p className="font-display text-lg font-semibold tracking-[0.08em]">
            ENSHROUDED
          </p>
          <p className="text-sm text-muted-foreground">
            Server Manager {version ? `· version ${version}` : ""}
          </p>
        </div>
      </div>
      <DetailList className="border-y border-border/55">
        {dataDir ? (
          <Detail label="App data">
            <span
              className="min-w-0 truncate font-mono text-xs"
              title={dataDir}
            >
              {dataDir}
            </span>
            <RevealButton path={dataDir} label="Show in Explorer" />
          </Detail>
        ) : null}
        {SHORTCUTS.map(([keys, what]) => (
          <Detail key={keys} label={what}>
            <Kbd>{keys}</Kbd>
          </Detail>
        ))}
      </DetailList>
    </div>
  );
};

const Settings = () => (
  <Page>
    <PageHeader
      title="App settings"
      description="How the manager looks, the SteamCMD it uses, and where it keeps its things."
    />
    <Section
      layout="split"
      title="Appearance"
      description="Shroud for the night, Embervale for daylight."
    >
      <Appearance />
    </Section>
    <Section
      layout="split"
      rule
      title="SteamCMD"
      description="Valve's command-line Steam client. It downloads and updates the server's files."
    >
      <SteamCmdSettings />
    </Section>
    <Section
      layout="split"
      rule
      title="About"
      description="The manager keeps its settings and its copy of SteamCMD in its data folder."
    >
      <About />
    </Section>
  </Page>
);

export const Route = createFileRoute("/settings")({
  component: Settings,
});
