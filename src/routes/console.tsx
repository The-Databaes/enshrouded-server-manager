import { createFileRoute } from "@tanstack/react-router";
import { TerminalIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/console")({
  component: () => (
    <PlaceholderPage
      title="Console"
      description="Live server output and command input."
      icon={TerminalIcon}
    />
  ),
});
