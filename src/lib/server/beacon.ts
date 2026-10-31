import type { RuntimeStatus } from "@/lib/server/runtime-types";

/**
 * The server's state as a flame: lit and flickering while it runs, burning
 * shroud-violet while it lights or banks, grey embers when it's out, and
 * guttering orange when it has stopped answering.
 */
export type BeaconState = "lit" | "kindling" | "faltering" | "out";

export const beaconState = (status: RuntimeStatus | null): BeaconState => {
  switch (status?.phase) {
    case "running":
      return status.responding ? "lit" : "faltering";
    case "starting":
    case "stopping":
      return "kindling";
    default:
      return "out";
  }
};
