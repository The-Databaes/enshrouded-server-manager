import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SteamCmdGate } from "@/components/steamcmd/steamcmd-gate";
import { SteamCmdProvider } from "@/components/steamcmd/steamcmd-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SteamCmdApi } from "@/lib/steamcmd/api";
import type { SteamCmdStatus } from "@/lib/steamcmd/types";

const base: SteamCmdStatus = {
  availability: "notConfigured",
  executable: null,
  managed: false,
  lastUpdatedAt: null,
  managedDir: "C:\\data\\steamcmd",
  busy: false,
  canDownload: true,
};

const api = vi.hoisted(() => ({}) as Record<keyof SteamCmdApi, unknown>);

vi.mock("@/lib/steamcmd/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/steamcmd/api")>();
  return { ...actual, steamcmdApi: () => api };
});

const renderGate = () =>
  render(
    <TooltipProvider>
      <SteamCmdProvider>
        <SteamCmdGate>
          <p>the app</p>
        </SteamCmdGate>
      </SteamCmdProvider>
    </TooltipProvider>,
  );

beforeEach(() => {
  Object.assign(api, {
    status: vi.fn(async () => base),
    detect: vi.fn(async () => []),
    inspect: vi.fn(async (path: string) =>
      path === "C:\\steamcmd"
        ? { executable: "C:\\steamcmd\\steamcmd.exe", error: null }
        : {
            executable: null,
            error: "There's no steamcmd.exe in this folder.",
          },
    ),
    adoptExisting: vi.fn(async () => ({
      ...base,
      availability: "ready",
      executable: "C:\\steamcmd\\steamcmd.exe",
    })),
    install: vi.fn(),
    cancel: vi.fn(async () => {}),
  });
});

describe("SteamCmdGate", () => {
  it("lets the app through when SteamCMD is ready", async () => {
    vi.mocked(api.status as SteamCmdApi["status"]).mockResolvedValue({
      ...base,
      availability: "ready",
      executable: "C:\\steamcmd\\steamcmd.exe",
    });
    renderGate();
    expect(await screen.findByText("the app")).toBeInTheDocument();
  });

  it("says so when the backend doesn't answer", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(api.status as SteamCmdApi["status"]).mockReturnValue(
        new Promise(() => {}),
      );
      renderGate();
      expect(screen.getByText("Kindling the Flame…")).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(8000));
      expect(
        screen.getByText("The app's background service isn't answering"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Try again/ })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks the app until an existing install is chosen", async () => {
    const user = userEvent.setup();
    renderGate();

    expect(
      await screen.findByText("Before the Flame is lit"),
    ).toBeInTheDocument();
    expect(screen.queryByText("the app")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("radio", { name: /I already have SteamCMD/ }),
    );
    const input = screen.getByLabelText("SteamCMD folder");
    const submit = screen.getByRole("button", { name: "Use this SteamCMD" });

    await user.type(input, "C:\\nope");
    expect(
      await screen.findByText("There's no steamcmd.exe in this folder."),
    ).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.clear(input);
    await user.type(input, "C:\\steamcmd");
    await screen.findByText("C:\\steamcmd\\steamcmd.exe");
    await user.click(submit);

    expect(api.adoptExisting).toHaveBeenCalledWith("C:\\steamcmd");
    // Success screen stays up until the user continues.
    expect(await screen.findByText("The path is clear")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Continue to the server/ }),
    );
    expect(screen.getByText("the app")).toBeInTheDocument();
  });

  it("shows download progress and failures with a retry", async () => {
    const user = userEvent.setup();
    vi.mocked(api.install as SteamCmdApi["install"]).mockImplementation(
      async (onEvent) => {
        onEvent({ event: "stage", data: { stage: "downloading" } });
        onEvent({ event: "log", data: { line: "Downloading steamcmd.zip" } });
        throw { kind: "http", message: "Download failed: offline" };
      },
    );
    renderGate();

    await user.click(
      await screen.findByRole("button", { name: /Download SteamCMD/ }),
    );

    expect(
      await screen.findByText("Download failed: offline"),
    ).toBeInTheDocument();
    // The log opens automatically on failure.
    expect(screen.getByText("Downloading steamcmd.zip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeEnabled();
    expect(screen.queryByText("the app")).not.toBeInTheDocument();
  });
});
