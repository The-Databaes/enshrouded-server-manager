import { createFileRoute } from "@tanstack/react-router";
import { ServerIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/servers")({
  component: () => (
    <PlaceholderPage
      title="Servers"
      description="Dedicated server instances, install paths and launch settings."
      icon={ServerIcon}
    />
  ),
});
