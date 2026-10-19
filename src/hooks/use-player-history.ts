import { useEffect, useState } from "react";

import { useServerRuntime } from "@/hooks/use-server-runtime";
import { runtimeApi } from "@/lib/server/runtime-api";
import type { PlayerSample } from "@/lib/server/runtime-types";

/** The backend samples once a minute; there's no point asking more often. */
const REFRESH_MS = 60_000;

/** Players online over the last day, sampled while the server ran. */
export const usePlayerHistory = () => {
  const [history, setHistory] = useState<PlayerSample[]>([]);
  // A start or stop adds a sample straight away.
  const phase = useServerRuntime((s) => s.status?.phase);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      runtimeApi()
        .playerHistory()
        .then((h) => {
          if (!cancelled) setHistory(h);
        })
        // Only a chart; it'll catch up on the next refresh.
        .catch(() => {});
    void load();
    const id = phase === "running" ? setInterval(load, REFRESH_MS) : null;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [phase]);

  return history;
};
