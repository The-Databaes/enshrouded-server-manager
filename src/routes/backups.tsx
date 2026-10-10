import { createFileRoute } from "@tanstack/react-router";
import { ArchiveIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/backups")({
  component: () => (
    <PlaceholderPage
      title="Backups"
      description="Scheduled world saves and restore points."
      icon={ArchiveIcon}
    />
  ),
});
