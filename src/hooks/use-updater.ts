import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import {
  INITIAL_UPDATE_STATE,
  type UpdateState,
  type UpdateStore,
} from "@/lib/app/update-store";
import { RELEASES_URL, releaseUrl } from "@/lib/app/updater-api";

export const UpdateStoreContext = createContext<UpdateStore | null>(null);

const useUpdateStore = () => {
  const store = useContext(UpdateStoreContext);
  if (!store)
    throw new Error("useUpdater must be used inside <UpdaterProvider>");
  return store;
};

/** A slice of the manager's update state (select the narrowest thing). */
export const useUpdater = <T>(selector: (state: UpdateState) => T): T => {
  const store = useUpdateStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(INITIAL_UPDATE_STATE),
  );
};

export const useUpdateActions = () => {
  const store = useUpdateStore();
  return useMemo(
    () => ({
      /**
       * Check now. With `toasts`, say how it went (for places that show
       * nothing else, like the command palette); a find opens the dialog.
       */
      check: async ({ toasts = false } = {}) => {
        const result = await store.check();
        if (!toasts) return result;
        if (result.outcome === "available") store.openDialog();
        else if (result.outcome === "upToDate") {
          const version = store.getState().currentVersion;
          toast.success("You're up to date", {
            description: version
              ? `Version ${version} is the latest.`
              : undefined,
          });
        } else if (result.error.kind === "updateNoRelease") {
          toast.info("No releases yet", { description: result.error.message });
        } else {
          toast.error("Couldn't check for updates", {
            description: result.error.message,
          });
        }
        return result;
      },
      install: store.install,
      openDialog: store.openDialog,
      closeDialog: store.closeDialog,
      skip: store.skip,
      unskip: store.unskip,
      setAutoCheck: store.setAutoCheck,
      setResumeServer: store.setResumeServer,
      isCommitted: store.isCommitted,
      /** A release's page on GitHub, or the list of releases. */
      openReleasePage: (version?: string) =>
        void store
          .openUrl(version ? releaseUrl(version) : RELEASES_URL)
          .catch(() => {}),
      openUrl: (url: string) => void store.openUrl(url).catch(() => {}),
    }),
    [store],
  );
};
