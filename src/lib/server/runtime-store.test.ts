import { describe, expect, it } from "vitest";
import type { RuntimeApi } from "@/lib/server/runtime-api";
import {
  appendLog,
  applyStatus,
  createRuntimeStore,
  MAX_LOG_LINES,
} from "@/lib/server/runtime-store";
import type { LogLine, RuntimeStatus } from "@/lib/server/runtime-types";

const line = (seq: number): LogLine => ({
  seq,
  at: 0,
  kind: "output",
  text: `line ${seq}`,
});

const status = (revision: number, phase: RuntimeStatus["phase"]) =>
  ({ revision, phase }) as RuntimeStatus;

describe("appendLog", () => {
  it("skips lines it already has and keeps the result in order", () => {
    const log = [line(1), line(2)];
    expect(appendLog(log, [line(2), line(3)]).map((l) => l.seq)).toEqual([
      1, 2, 3,
    ]);
    expect(appendLog(log, [line(1)])).toBe(log);
  });

  it("keeps only the newest lines", () => {
    const full = Array.from({ length: MAX_LOG_LINES }, (_, i) => line(i + 1));
    const next = appendLog(full, [line(MAX_LOG_LINES + 1)]);
    expect(next).toHaveLength(MAX_LOG_LINES);
    expect(next[0].seq).toBe(2);
  });
});

describe("applyStatus", () => {
  it("ignores updates older than the current one", () => {
    const current = status(5, "running");
    expect(applyStatus(current, status(4, "starting"))).toBe(current);
    expect(applyStatus(current, status(6, "stopping")).phase).toBe("stopping");
  });
});

describe("createRuntimeStore", () => {
  it("merges the snapshot with events that arrived while it loaded", async () => {
    let pushLog: (lines: LogLine[]) => void = () => {};
    let pushStatus: (s: RuntimeStatus) => void = () => {};
    const api = {
      onStatus: async (h) => {
        pushStatus = h;
        return () => {};
      },
      onLog: async (h) => {
        pushLog = h;
        return () => {};
      },
      status: async () => {
        // A newer status and a new line arrive before the snapshot does.
        pushStatus(status(3, "running"));
        pushLog([line(3)]);
        return status(2, "starting");
      },
      log: async () => [line(1), line(2)],
    } as Partial<RuntimeApi> as RuntimeApi;
    const store = createRuntimeStore(api, async () => null);

    const disconnect = store.connect();
    await new Promise((r) => setTimeout(r, 0));
    const state = store.getState();
    expect(state.status?.phase).toBe("running");
    expect(state.log.map((l) => l.seq)).toEqual([1, 2, 3]);
    disconnect();
  });
});
