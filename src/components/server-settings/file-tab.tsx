import { FileCogIcon } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SettingsFile } from "@/lib/server/settings-api";
import type { SettingsChange, SettingsDoc } from "@/lib/server/settings-editor";
import { steamcmdApi } from "@/lib/steamcmd/api";

const describe = (change: SettingsChange) =>
  change.op === "unban"
    ? `Lift ban on ${change.accountIdHash}`
    : `${change.path.join(".")} → ${JSON.stringify(change.value)}`;

/** The file itself: what will be saved, and where it lives. */
export const FileTab = ({
  file,
  draft,
  changes,
}: {
  file: SettingsFile;
  draft: SettingsDoc;
  changes: SettingsChange[];
}) => {
  const json = useMemo(() => JSON.stringify(draft, null, 2), [draft]);
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Unsaved changes</CardTitle>
          <CardDescription>
            Only these are written; everything else in the file stays as it is.
            The previous version is kept as enshrouded_server.json.bak.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changes.length ? (
            <ul className="space-y-1 font-mono text-xs">
              {changes.map((c) => (
                <li key={describe(c)} className="break-all">
                  {describe(c)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>enshrouded_server.json</CardTitle>
          <CardDescription className="break-all">{file.path}</CardDescription>
          {file.file === "ok" ? (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void steamcmdApi().reveal(file.path)}
              >
                <FileCogIcon data-icon="inline-start" />
                Show file
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-console p-4 font-mono text-[0.72rem] leading-relaxed text-foreground/85">
            {json}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            With your changes applied. The server rewrites this file in its own
            format each time it starts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
