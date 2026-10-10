import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/app-shell";
import { SteamCmdSettingsCard } from "@/components/steamcmd/steamcmd-settings-card";

const Settings = () => {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Application preferences and server tooling."
      />
      <div className="grid max-w-3xl gap-4">
        <SteamCmdSettingsCard />
      </div>
    </>
  );
};

export const Route = createFileRoute("/settings")({
  component: Settings,
});
