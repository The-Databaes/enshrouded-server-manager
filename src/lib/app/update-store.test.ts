import { describe, expect, it, vi } from "vitest";

import {
  applyInstallEvent,
  createUpdateStore,
  downloadEtaMs,
  downloadPercent,
  INITIAL_UPDATE_STATE,
  type InstallProgress,
  isNewerVersion,
  type KeyValueStorage,
  shouldAnnounce,
  updateStatus,
} from "@/lib/app/update-store";
import type { AvailableUpdate, UpdaterApi } from "@/lib/app/updater-api";

const UPDATE: AvailableUpdate = {
  version: "0.2.0",
  currentVersion: "0.1.0",
  date: null,
  notes: null,
};

const memoryStorage = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

const fakeApi = (over: Partial<UpdaterApi> = {}): UpdaterApi => ({
  currentVersion: async () => "0.1.0",
  check: async () => UPDATE,
  install: async () => {},
  openUrl: async () => {},
  ...over,
});

const progress = (over: Partial<InstallProgress> = {}): InstallProgress => ({
  step: "starting",
  downloaded: 0,
  total: null,
  rate: null,
  sampledAt: 0,
  stoppedServer: false,
  ...over,
});

describe("updateStatus", () => {
  it("puts an install ahead of everything", () => {
    expect(
      updateStatus({
        ...INITIAL_UPDATE_STATE,
        checking: true,
        update: UPDATE,
        install: progress(),
      }),
    ).toBe("installing");
  });

  it("is unknown before the first check", () => {
    expect(updateStatus(INITIAL_UPDATE_STATE)).toBe("unknown");
  });

  it("names what went wrong with the last check", () => {
    const statusAfter = (kind: string) =>
      updateStatus({
        ...INITIAL_UPDATE_STATE,
        lastCheck: { at: 1, error: { kind: kind as never, message: "" } },
      });
    expect(statusAfter("updateNoRelease")).toBe("noRelease");
    expect(statusAfter("updateOffline")).toBe("offline");
    expect(statusAfter("update")).toBe("failed");
  });

  it("keeps a known update through a failed check", () => {
    expect(
      updateStatus({
        ...INITIAL_UPDATE_STATE,
        update: UPDATE,
        lastCheck: { at: 1, error: { kind: "updateOffline", message: "" } },
      }),
    ).toBe("available");
  });
});

describe("applyInstallEvent", () => {
  it("doesn't measure a rate from the connection time before the first bytes", () => {
    const next = applyInstallEvent(
      progress({ sampledAt: 0 }),
      { event: "downloading", data: { downloaded: 1000, total: 10_000 } },
      5000,
    );
    expect(next).toMatchObject({
      step: "downloading",
      downloaded: 1000,
      rate: null,
    });
  });

  it("smooths the rate between readings", () => {
    let p = progress({ step: "downloading", downloaded: 0, sampledAt: 0 });
    p = applyInstallEvent(
      p,
      { event: "downloading", data: { downloaded: 1000, total: null } },
      1000,
    );
    expect(p.rate).toBe(1000);
    p = applyInstallEvent(
      p,
      { event: "downloading", data: { downloaded: 4000, total: null } },
      2000,
    );
    expect(p.rate).toBeCloseTo(1000 * 0.75 + 3000 * 0.25);
  });

  it("fills the bar once verified, and remembers stopping the server", () => {
    let p = progress({ step: "downloading", downloaded: 900, total: 1000 });
    p = applyInstallEvent(p, { event: "verified" }, 1);
    expect(downloadPercent(p)).toBe(100);
    p = applyInstallEvent(p, { event: "stoppingServer" }, 2);
    expect(p).toMatchObject({ step: "stoppingServer", stoppedServer: true });
  });
});

describe("download figures", () => {
  it("has no percent or estimate without a size", () => {
    const p = progress({ step: "downloading", downloaded: 10, rate: 5 });
    expect(downloadPercent(p)).toBeNull();
    expect(downloadEtaMs(p)).toBeNull();
  });

  it("estimates the time left from the rate", () => {
    const p = progress({
      step: "downloading",
      downloaded: 1000,
      total: 3000,
      rate: 500,
    });
    expect(downloadEtaMs(p)).toBe(4000);
  });
});

describe("isNewerVersion", () => {
  it("compares dotted numbers, not text", () => {
    expect(isNewerVersion("0.10.0", "0.9.0")).toBe(true);
    expect(isNewerVersion("v1.0.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("0.2.0", "0.2.0")).toBe(false);
    expect(isNewerVersion("0.2.0-beta.1", "0.2.0")).toBe(false);
    expect(isNewerVersion("0.1.0", "0.2.0")).toBe(false);
  });
});

describe("shouldAnnounce", () => {
  it("stays quiet about skipped and already-announced versions", () => {
    expect(shouldAnnounce(UPDATE, null, new Set())).toBe(true);
    expect(shouldAnnounce(UPDATE, "0.2.0", new Set())).toBe(false);
    expect(shouldAnnounce(UPDATE, null, new Set(["0.2.0"]))).toBe(false);
    expect(shouldAnnounce(null, null, new Set())).toBe(false);
  });
});

describe("createUpdateStore", () => {
  it("runs one check however many places ask", async () => {
    const check = vi.fn(async () => UPDATE);
    const store = createUpdateStore(fakeApi({ check }), memoryStorage());
    const [a, b] = await Promise.all([store.check(), store.check()]);
    expect(check).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(store.getState().update).toEqual(UPDATE);
  });

  it("records a failed check without forgetting a known update", async () => {
    let fail = false;
    const store = createUpdateStore(
      fakeApi({
        check: async () => {
          if (fail) throw { kind: "updateOffline", message: "offline" };
          return UPDATE;
        },
      }),
      memoryStorage(),
    );
    await store.check();
    fail = true;
    const result = await store.check();
    expect(result).toMatchObject({
      outcome: "failed",
      error: { kind: "updateOffline" },
    });
    expect(store.getState().update).toEqual(UPDATE);
  });

  it("can't start a second install, and keeps the failure for the dialog", async () => {
    let reject: (e: unknown) => void = () => {};
    const install = vi.fn(
      () =>
        new Promise<void>((_, r) => {
          reject = r;
        }),
    );
    const store = createUpdateStore(fakeApi({ install }), memoryStorage());
    await store.check();
    const first = store.install();
    void store.install();
    expect(install).toHaveBeenCalledTimes(1);
    reject({ kind: "updateVerification", message: "bad" });
    await first;
    expect(store.getState().install).toBeNull();
    expect(store.getState().installError?.kind).toBe("updateVerification");
  });

  it("won't let the dialog close once the server is being stopped", async () => {
    let emit: Parameters<UpdaterApi["install"]>[0] = () => {};
    const store = createUpdateStore(
      fakeApi({
        install: (onEvent) => {
          emit = onEvent;
          return new Promise(() => {});
        },
      }),
      memoryStorage(),
    );
    await store.check();
    void store.install();
    emit({ event: "stoppingServer" });
    store.closeDialog();
    expect(store.getState().dialogOpen).toBe(true);
  });

  it("remembers the skipped version and the auto-check choice", () => {
    const storage = memoryStorage();
    const store = createUpdateStore(fakeApi(), storage);
    store.skip("0.2.0");
    store.setAutoCheck(false);
    const again = createUpdateStore(fakeApi(), storage);
    expect(again.getState()).toMatchObject({
      skippedVersion: "0.2.0",
      autoCheck: false,
    });
  });

  it("reports the version that ran last time", async () => {
    const storage = memoryStorage();
    storage.setItem("esm-last-version", "0.1.0");
    const store = createUpdateStore(
      fakeApi({ currentVersion: async () => "0.2.0" }),
      storage,
    );
    expect(await store.loadVersion()).toEqual({
      current: "0.2.0",
      previous: "0.1.0",
    });
    expect(storage.data.get("esm-last-version")).toBe("0.2.0");
  });

  it("asks for the server back once, and only soon after stopping it", async () => {
    const storage = memoryStorage();
    let emit: Parameters<UpdaterApi["install"]>[0] = () => {};
    const store = createUpdateStore(
      fakeApi({
        install: (onEvent) => {
          emit = onEvent;
          return new Promise(() => {});
        },
      }),
      storage,
    );
    await store.check();
    void store.install();
    emit({ event: "stoppingServer" });
    const stoppedAt = Number(storage.data.get("esm-update-resume-at"));
    expect(store.takeResumeRequest(stoppedAt + 1000)).toBe(true);
    expect(store.takeResumeRequest(stoppedAt + 1000)).toBe(false);

    storage.setItem("esm-update-resume-at", String(stoppedAt));
    expect(store.takeResumeRequest(stoppedAt + 31 * 60 * 1000)).toBe(false);
  });

  it("doesn't ask for the server back when the user said not to, or the install failed", async () => {
    const storage = memoryStorage();
    let emit: Parameters<UpdaterApi["install"]>[0] = () => {};
    let fail: (e: unknown) => void = () => {};
    const store = createUpdateStore(
      fakeApi({
        install: (onEvent) => {
          emit = onEvent;
          return new Promise((_, reject) => {
            fail = reject;
          });
        },
      }),
      storage,
    );
    await store.check();
    const running = store.install();
    emit({ event: "stoppingServer" });
    fail({ kind: "update", message: "installer refused" });
    await running;
    expect(storage.data.has("esm-update-resume-at")).toBe(false);

    store.setResumeServer(false);
    void store.install();
    emit({ event: "stoppingServer" });
    expect(storage.data.has("esm-update-resume-at")).toBe(false);
  });

  it("works with storage switched off", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {},
    };
    const store = createUpdateStore(fakeApi(), broken);
    expect(() => store.skip("0.2.0")).not.toThrow();
    expect(store.getState().autoCheck).toBe(true);
  });
});
