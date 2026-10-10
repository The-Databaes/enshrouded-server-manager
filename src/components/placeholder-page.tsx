import { ConstructionIcon } from "lucide-react";

import { PageHeader } from "@/components/app-shell/app-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type PlaceholderPageProps = {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
};

/** Stand-in for pages whose logic hasn't been built yet. */
export const PlaceholderPage = ({
  title,
  description,
  icon: Icon = ConstructionIcon,
}: PlaceholderPageProps) => {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Empty className="flex-1 bg-shroud-mist">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-flame/15 text-flame">
            <Icon />
          </EmptyMedia>
          <EmptyTitle className="font-display tracking-wider">
            Still beyond the Shroud
          </EmptyTitle>
          <EmptyDescription>
            This screen is laid out but the logic behind it hasn't been written
            yet.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" disabled>
            Coming soon
          </Button>
        </EmptyContent>
      </Empty>
    </>
  );
};
