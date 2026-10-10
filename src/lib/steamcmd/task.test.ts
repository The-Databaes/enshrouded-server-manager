import { describe, expect, it } from "vitest";

import {
  applyEvent,
  finishTask,
  formatBytes,
  formatRate,
  MAX_LOG_LINES,
  progressSummary,
  startTask,
} from "@/lib/steamcmd/task";
import type { SteamCmdEvent } from "@/lib/steamcmd/types";

const progress = (
  percent: number,
  current: number | null,
  total: number | null,
  label = "downloading",
): SteamCmdEvent => ({
  event: "progress",
  data: { percent, label, current, total },
});

describe("SteamCMD task reducer", () => {
  it("tracks stages, download bytes and percentages", () => {
    let task = startTask("install");
    task = applyEvent(task, { event: "stage", data: { stage: "downloading" } });
    task = applyEvent(task, {
      event: "download",
      data: { received: 512, total: 2048 },
    });
    expect(task.progress.percent).toBe(25);

    // A new stage starts indeterminate until it reports progress.
    task = applyEvent(task, { event: "stage", data: { stage: "updating" } });
    expect(task.progress.percent).toBeNull();
    task = applyEvent(task, progress(45, null, null, "Downloading update"));
    expect(task).toMatchObject({
      stage: "updating",
      progress: { percent: 45, label: "Downloading update" },
    });
  });

  it("has no percentage when the download size is unknown", () => {
    const task = applyEvent(startTask("install"), {
      event: "download",
      data: { received: 100, total: null },
    });
    expect(task.progress.percent).toBeNull();
  });

  it("measures transfer rate from successive samples", () => {
    let task = startTask("serverInstall");
    task = applyEvent(task, progress(10, 1_000_000, 10_000_000), 0);
    expect(task.progress.rate).toBeNull();
    task = applyEvent(task, progress(30, 3_000_000, 10_000_000), 2000);
    expect(task.progress.rate).toBe(1_000_000);
    // A new phase (e.g. verifying) starts measuring afresh.
    task = applyEvent(
      task,
      progress(5, 500_000, 10_000_000, "verifying install"),
      3000,
    );
    expect(task.progress.rate).toBeNull();
  });

  it("shows an unfinished line until it completes", () => {
    let task = startTask("serverInstall");
    task = applyEvent(task, {
      event: "partial",
      data: { line: "Waiting for user info..." },
    });
    expect(task.partial).toBe("Waiting for user info...");
    task = applyEvent(task, {
      event: "log",
      data: { line: "Waiting for user info...OK" },
    });
    expect(task.partial).toBeNull();
    expect(task.log).toEqual(["Waiting for user info...OK"]);
  });

  it("treats 0% without a size as indeterminate", () => {
    const task = applyEvent(
      startTask("serverInstall"),
      progress(0, null, null, "Checking for available updates"),
    );
    expect(task.progress.percent).toBeNull();
  });

  it("caps the log", () => {
    let task = startTask("update");
    for (let i = 0; i < MAX_LOG_LINES + 10; i++) {
      task = applyEvent(task, { event: "log", data: { line: `line ${i}` } });
    }
    expect(task.log).toHaveLength(MAX_LOG_LINES);
    expect(task.log.at(-1)).toBe(`line ${MAX_LOG_LINES + 9}`);
  });

  it("distinguishes success, cancellation and failure", () => {
    const task = startTask("install");
    expect(finishTask(task, null).phase).toBe("succeeded");
    expect(
      finishTask(task, { kind: "cancelled", message: "Cancelled." }).phase,
    ).toBe("cancelled");
    const failed = finishTask(task, { kind: "http", message: "offline" });
    expect(failed).toMatchObject({
      phase: "failed",
      error: { message: "offline" },
    });
  });
});

describe("formatBytes", () => {
  it("picks a sensible unit", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(4096)).toBe("4 KB");
    expect(formatBytes(3_870_000)).toBe("3.7 MB");
    expect(formatBytes(8_811_579_458)).toBe("8.21 GB");
  });
});

// Figures measured on a real install of app 2278520 while sampling the
// network adapter: SteamCMD's counter ran at ~105 MB/s (decimal) while the
// network carried ~47 MB/s, and the content log reported a 3,734,339,456
// byte download for 8,811,579,458 bytes of files.
describe("progressSummary", () => {
  const DOWNLOAD = 3_734_339_456;
  const STAGE = 8_811_579_458;
  const at = (current: number) =>
    progress((current / STAGE) * 100, current, STAGE);

  it("reports real network figures once the download plan is known", () => {
    let task = startTask("serverInstall");
    task = applyEvent(task, {
      event: "downloadPlan",
      data: { downloadTotal: DOWNLOAD, stageTotal: STAGE },
    });
    task = applyEvent(task, at(4_000_000_000), 0);
    task = applyEvent(task, at(4_000_000_000 + 105e6 * 2), 2000);
    const summary = progressSummary(task);
    // 4.21e9 written ≈ 1.78e9 downloaded = 1.66 GiB of 3.48 GiB.
    expect(summary).toBe(
      "Downloading · 1.66 GB of 3.48 GB · ≈42.4 MB/s (356 Mbit/s) · 47%",
    );
  });

  it("doesn't claim a network speed without the plan", () => {
    let task = startTask("serverInstall");
    task = applyEvent(task, at(4_000_000_000), 0);
    task = applyEvent(task, at(4_210_000_000), 2000);
    expect(progressSummary(task)).toBe(
      "Downloading · 47% · 3.92 GB of 8.21 GB unpacked",
    );
  });

  it("shows verification without a speed", () => {
    let task = startTask("serverVerify");
    task = applyEvent(
      task,
      progress(46, 3_800_000_000, STAGE, "verifying install"),
      0,
    );
    task = applyEvent(
      task,
      progress(69, 5_700_000_000, STAGE, "verifying install"),
      2000,
    );
    expect(progressSummary(task)).toBe(
      "Verifying install · 5.31 GB of 8.21 GB · 69%",
    );
  });

  it("shows speed for real network transfers", () => {
    let task = startTask("install");
    task = applyEvent(
      task,
      { event: "download", data: { received: 0, total: 4_000_000 } },
      0,
    );
    task = applyEvent(
      task,
      { event: "download", data: { received: 2_000_000, total: 4_000_000 } },
      1000,
    );
    expect(progressSummary(task)).toBe(
      "Downloading installer · 1.9 MB of 3.8 MB · 1.9 MB/s (16 Mbit/s) · 50%",
    );
  });
});

describe("formatRate", () => {
  it("gives binary MB/s like Explorer and decimal Mbit/s like ISPs", () => {
    expect(formatRate(47e6)).toBe("44.8 MB/s (376 Mbit/s)");
  });
});
