import {
  CheckCircle2Icon,
  FolderOpenIcon,
  SearchCheckIcon,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useSteamCmd } from "@/hooks/use-steamcmd";
import { steamcmdApi, toAppError } from "@/lib/steamcmd/api";
import type { PathCheck } from "@/lib/steamcmd/types";

const parentDir = (exe: string) => exe.replace(/[\\/][^\\/]+$/, "");

type ExistingInstallFormProps = {
  /** Called after the chosen install has been saved to the config. */
  onSaved?: () => void;
  submitLabel?: string;
  disabled?: boolean;
};

/** Point the app at a SteamCMD the user installed themselves. */
export const ExistingInstallForm = ({
  onSaved,
  submitLabel = "Use this SteamCMD",
  disabled = false,
}: ExistingInstallFormProps) => {
  const { adoptExisting, status } = useSteamCmd();
  const inputId = useId();
  const [path, setPath] = useState("");
  const [check, setCheck] = useState<PathCheck | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    steamcmdApi()
      .detect()
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, []);

  // Validate as the user types (debounced) so problems show before saving.
  useEffect(() => {
    setSaveError(null);
    if (!path.trim()) {
      setCheck(null);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      steamcmdApi()
        .inspect(path)
        .then((result) => {
          if (!stale) setCheck(result);
        })
        .catch((error) => {
          if (!stale)
            setCheck({ executable: null, error: toAppError(error).message });
        });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [path]);

  const browse = async () => {
    const picked = await steamcmdApi().browse(path || undefined);
    if (picked) setPath(picked);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adoptExisting(path);
      onSaved?.();
    } catch (error) {
      setSaveError(toAppError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const valid = Boolean(check?.executable);
  // Don't suggest what's already typed in, or the install already in use.
  const otherCandidates = candidates.filter(
    (c) => c !== check?.executable && c !== status?.executable,
  );

  return (
    <form onSubmit={save} className="space-y-4">
      <Field data-invalid={check?.error ? true : undefined}>
        <FieldLabel htmlFor={inputId}>SteamCMD folder</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id={inputId}
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="C:\steamcmd"
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-xs"
            disabled={disabled || saving}
            aria-invalid={check?.error ? true : undefined}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              variant="secondary"
              onClick={() => void browse()}
              disabled={disabled || saving}
            >
              <FolderOpenIcon data-icon="inline-start" />
              Browse…
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {check?.executable ? (
          <FieldDescription className="flex items-center gap-1.5 text-success">
            <CheckCircle2Icon className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              Found <span className="font-mono">{check.executable}</span>
            </span>
          </FieldDescription>
        ) : check?.error ? (
          <FieldError>{check.error}</FieldError>
        ) : (
          <FieldDescription>
            The folder that contains steamcmd.exe. It will be used as-is and
            never deleted by the manager.
          </FieldDescription>
        )}
      </Field>

      {otherCandidates.length ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SearchCheckIcon className="size-3.5" />
            Found on this PC
          </p>
          <ul className="flex flex-wrap gap-2">
            {otherCandidates.map((exe) => (
              <li key={exe}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => setPath(parentDir(exe))}
                  disabled={disabled || saving}
                >
                  {parentDir(exe)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? <FieldError>{saveError}</FieldError> : null}

      <Button type="submit" disabled={!valid || disabled || saving}>
        {saving ? <Spinner data-icon="inline-start" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
};
