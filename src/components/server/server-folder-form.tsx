import {
  CircleCheckIcon,
  DownloadIcon,
  FolderOpenIcon,
  InfoIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { serverApi } from "@/lib/server/api";
import type { FolderCheck } from "@/lib/server/types";
import { toAppError } from "@/lib/steamcmd/api";

const FEEDBACK = {
  existingInstall: { icon: CircleCheckIcon, className: "text-success" },
  empty: { icon: InfoIcon, className: "text-muted-foreground" },
  notEmpty: { icon: TriangleAlertIcon, className: "text-warning" },
  invalid: { icon: TriangleAlertIcon, className: "text-destructive" },
} as const;

type ServerFolderFormProps = {
  initialPath: string;
  onSubmit: (path: string) => void;
  disabled?: boolean;
};

/** Pick where the server lives; shows what will happen before committing. */
export const ServerFolderForm = ({
  initialPath,
  onSubmit,
  disabled = false,
}: ServerFolderFormProps) => {
  const inputId = useId();
  const [path, setPath] = useState(initialPath);
  const [check, setCheck] = useState<FolderCheck | null>(null);

  useEffect(() => {
    let stale = false;
    const timer = setTimeout(() => {
      serverApi()
        .inspectFolder(path)
        .then((result) => {
          if (!stale) setCheck(result);
        })
        .catch((error) => {
          if (!stale)
            setCheck({
              kind: "invalid",
              message: toAppError(error).message,
              buildId: null,
            });
        });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [path]);

  const browse = async () => {
    const picked = await serverApi().browse(path || undefined);
    if (picked) setPath(picked);
  };

  const feedback = check ? FEEDBACK[check.kind] : null;
  const existing = check?.kind === "existingInstall";
  const canSubmit = check !== null && check.kind !== "invalid" && !disabled;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(path.trim());
      }}
    >
      <Field data-invalid={check?.kind === "invalid" ? true : undefined}>
        <FieldLabel htmlFor={inputId}>Server folder</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id={inputId}
            value={path}
            onChange={(e) => setPath(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-xs"
            disabled={disabled}
            aria-invalid={check?.kind === "invalid" ? true : undefined}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              variant="secondary"
              onClick={() => void browse()}
              disabled={disabled}
            >
              <FolderOpenIcon data-icon="inline-start" />
              Browse…
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {check && feedback ? (
          <FieldDescription
            className={`flex items-start gap-1.5 ${feedback.className}`}
          >
            <feedback.icon className="mt-0.5 size-3.5 shrink-0" />
            {check.message}
          </FieldDescription>
        ) : (
          <FieldDescription>&nbsp;</FieldDescription>
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={!canSubmit}
          className={existing ? undefined : "shadow-ember"}
        >
          {existing ? (
            <ShieldCheckIcon data-icon="inline-start" />
          ) : (
            <DownloadIcon data-icon="inline-start" />
          )}
          {existing ? "Verify and use this server" : "Install server"}
        </Button>
        {existing ? null : (
          <p className="text-xs text-muted-foreground">
            Currently about a 3.5 GB download that unpacks to 8.2 GB. Make sure
            the drive has at least 10 GB free.
          </p>
        )}
      </div>
    </form>
  );
};
