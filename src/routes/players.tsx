import { createFileRoute } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/players")({
  component: () => (
    <PlaceholderPage
      title="Players"
      description="Who is online, bans, whitelist and permissions."
      icon={UsersIcon}
    />
  ),
});
