import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SteamCmdProvider } from "@/components/steamcmd/steamcmd-provider";
import type { ServerApi } from "@/lib/server/api";
import type { ServerStatus } from "@/lib/server/types";
import type { SteamCmdApi } from "@/lib/steamcmd/api";
import { Route } from "@/routes/servers";

const notInstalled: ServerStatus = {
  state: "notInstalled",
  appId: "2278520",
  installDir: null,
  defaultInstallDir: "C:\\Users\\you\\.enshrouded-server-manager\\server",
  buildId: null,
  sizeOnDisk: null,
  lastUpdatedAt: null,
  lastVerifiedAt: null,
  latestBuildId: null,
  lastCheckedAt: null,
  updateAvailable: null,
};

const installed: ServerStatus = {
  ...notInstalled,
  state: "installed",
  installDir: notInstalled.defaultInstallDir,
  buildId: "23178631",
  sizeOnDisk: 8_811_579_458,
  latestBuildId: "23178631",
  updateAvailable: false,
};

const server = vi.hoisted(() => ({}) as Record<keyof ServerApi, unknown>);
const steamcmd = vi.hoisted(() => ({}) as Record<keyof SteamCmdApi, unknown>);

vi.mock("@/lib/server/api", () => ({ serverApi: () => server }));
vi.mock("@/lib/steamcmd/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/steamcmd/api")>();
  return { ...actual, steamcmdApi: () => steamcmd };
});

const Servers = Route.options.component as React.ComponentType;

beforeEach(() => {
  Object.assign(steamcmd, {
    status: vi.fn(async () => ({ availability: "ready" })),
    cancel: vi.fn(async () => {}),
  });
  Object.assign(server, {
    status: vi.fn(async () => notInstalled),
    inspectFolder: vi.fn(async () => ({
      kind: "empty",
      message: "The server will be installed here.",
      buildId: null,
    })),
  });
});

describe("Servers page", () => {
  it("installs the server with live console output", async () => {
    const user = userEvent.setup();
    let finish: (s: ServerStatus) => void = () => {};
    server.install = vi.fn(
      (_path: string, onEvent: Parameters<ServerApi["install"]>[1]) => {
        onEvent({
          event: "log",
          data: { line: "Connecting anonymously to Steam Public...OK" },
        });
        onEvent({
          event: "downloadPlan",
          data: { downloadTotal: 3_734_339_456, stageTotal: 8_811_579_458 },
        });
        onEvent({
          event: "progress",
          data: {
            percent: 50,
            label: "downloading",
            current: 4_405_789_729,
            total: 8_811_579_458,
          },
        });
        return new Promise<ServerStatus>((resolve) => {
          finish = resolve;
        });
      },
    );

    render(
      <SteamCmdProvider>
        <Servers />
      </SteamCmdProvider>,
    );

    await screen.findByText("The server will be installed here.");
    await user.click(screen.getByRole("button", { name: "Install server" }));

    expect(server.install).toHaveBeenCalledWith(
      notInstalled.defaultInstallDir,
      expect.any(Function),
    );
    // Live output, and progress in real network terms (the counter is
    // uncompressed bytes; the plan scales it to what's downloaded).
    expect(
      await screen.findByText("Connecting anonymously to Steam Public...OK"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Downloading · 1.74 GB of 3.48 GB · 50%"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();

    vi.mocked(server.status as ServerApi["status"]).mockResolvedValue(
      installed,
    );
    finish(installed);

    expect(await screen.findByText("Server installed")).toBeInTheDocument();
    expect(await screen.findByText("Up to date")).toBeInTheDocument();
    expect(screen.getByText("23178631")).toBeInTheDocument();
  });

  it("offers to resume an install that didn't finish", async () => {
    vi.mocked(server.status as ServerApi["status"]).mockResolvedValue({
      ...notInstalled,
      state: "incomplete",
      installDir: "D:\\Enshrouded",
    });
    render(
      <SteamCmdProvider>
        <Servers />
      </SteamCmdProvider>,
    );
    expect(
      await screen.findByText("The install didn't finish"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update server" }),
    ).toBeDisabled();
  });
});
