import { createFileRoute } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/settings")({
  component: () => (
    <PlaceholderPage
      title="Settings"
      description="Application preferences and server configuration."
      icon={SettingsIcon}
    />
  ),
});
