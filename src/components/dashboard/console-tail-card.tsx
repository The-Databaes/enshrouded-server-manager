import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { ServerConsole } from "@/components/server/server-console";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useServerRuntime } from "@/hooks/use-server-runtime";

/** The dashboard shows only the end of the console. */
const TAIL_LINES = 150;

/** The latest server console output. */
export const ConsoleTailCard = ({ className }: { className?: string }) => {
  const log = useServerRuntime((s) => s.log);
  const live = useServerRuntime(
    (s) => s.status?.phase === "starting" || s.status?.phase === "running",
  );
  const tail = useMemo(() => log.slice(-TAIL_LINES), [log]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Console</CardTitle>
        <CardDescription>Latest output from the server</CardDescription>
      </CardHeader>
      <CardContent>
        <ServerConsole
          lines={tail}
          live={live}
          timestamps={false}
          viewportClassName="h-56"
        />
      </CardContent>
      <CardFooter className="border-t">
        <Button variant="link" size="sm" className="px-0" asChild>
          <Link to="/console">Open full console</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
