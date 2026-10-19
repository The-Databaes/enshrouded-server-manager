import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatExitCode,
  phaseView,
} from "@/lib/server/runtime-display";
import type { RuntimeStatus } from "@/lib/server/runtime-types";

describe("formatDuration", () => {
  it("shows the two most useful units", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(12 * 60_000)).toBe("12m");
    expect(formatDuration((3 * 60 + 6) * 60_000)).toBe("3h 06m");
    expect(formatDuration((2 * 24 + 14) * 3_600_000)).toBe("2d 14h");
  });
});

describe("formatExitCode", () => {
  it("adds hex for Windows crash codes", () => {
    expect(formatExitCode(0)).toBe("0");
    expect(formatExitCode(3221225477)).toBe("3221225477 (0xC0000005)");
  });
});

describe("phaseView", () => {
  it("separates a running server that stopped answering", () => {
    const running = { phase: "running", responding: true } as RuntimeStatus;
    expect(phaseView(running).label).toBe("Online");
    expect(phaseView({ ...running, responding: false }).tone).toBe("warning");
    expect(phaseView(null).label).toBe("Offline");
  });
});
