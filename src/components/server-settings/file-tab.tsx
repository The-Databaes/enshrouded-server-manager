import { FileCogIcon, MinusIcon, PenLineIcon } from "lucide-react";
import { useMemo } from "react";

import { ListNotice } from "@/components/dashboard/online-players";
import { Section } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import type { SettingsFile } from "@/lib/server/settings-api";
import type { SettingsChange, SettingsDoc } from "@/lib/server/settings-editor";
import { steamcmdApi } from "@/lib/steamcmd/api";

const valueText = (value: unknown) => {
  const text = JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
};

/** JSON with keys, strings, numbers and literals coloured. */
const highlight = (json: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  const token =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  for (let m = token.exec(json); m; m = token.exec(json)) {
    if (m.index > last) out.push(json.slice(last, m.index));
    const [whole, str, colon, literal, number] = m;
    if (str && colon) {
      out.push(
        <span key={m.index} className="text-shroud">
          {str}
        </span>,
        colon,
      );
    } else if (str) {
      out.push(
        <span key={m.index} className="text-success">
          {str}
        </span>,
      );
    } else if (literal) {
      out.push(
        <span key={m.index} className="text-warning">
          {literal}
        </span>,
      );
    } else if (number) {
      out.push(
        <span key={m.index} className="text-ember">
          {number}
        </span>,
      );
    } else {
      out.push(whole);
    }
    last = m.index + whole.length;
  }
  out.push(json.slice(last));
  return out;
};

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
  const coloured = useMemo(() => highlight(json), [json]);

  return (
    <div className="space-y-14">
      <Section
        title="Unsaved changes"
        description="Only these are written; everything else in the file stays exactly as it is. The previous version is kept as enshrouded_server.json.bak."
      >
        {changes.length ? (
          <ul className="divide-y divide-border/55 border-y border-border/55 font-mono text-xs">
            {changes.map((c) =>
              c.op === "unban" ? (
                <li
                  key={`unban:${c.accountIdHash}`}
                  className="flex items-center gap-3 py-2.5"
                >
                  <MinusIcon className="size-3.5 shrink-0 text-destructive" />
                  <span className="text-muted-foreground">bannedAccounts</span>
                  <span className="truncate">lift {c.accountIdHash}</span>
                </li>
              ) : (
                <li
                  key={c.path.join(".")}
                  className="flex items-center gap-3 py-2.5"
                >
                  <PenLineIcon className="size-3.5 shrink-0 text-ember" />
                  <span className="shrink-0 text-shroud">
                    {c.path.join(".")}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="truncate">{valueText(c.value)}</span>
                </li>
              ),
            )}
          </ul>
        ) : (
          <ListNotice icon={PenLineIcon}>
            Nothing changed yet. Edits you make show up here before they're
            saved.
          </ListNotice>
        )}
      </Section>

      <Section
        title="enshrouded_server.json"
        description={
          <span className="font-mono text-xs break-all">{file.path}</span>
        }
        actions={
          file.file === "ok" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void steamcmdApi().reveal(file.path)}
            >
              <FileCogIcon data-icon="inline-start" />
              Show in Explorer
            </Button>
          ) : null
        }
      >
        <pre className="max-h-[36rem] overflow-auto rounded-xl border bg-console p-5 font-mono text-[0.74rem] leading-relaxed text-foreground/80">
          {coloured}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          Shown with your changes applied. The server rewrites the file in its
          own format each time it starts.
        </p>
      </Section>
    </div>
  );
};
