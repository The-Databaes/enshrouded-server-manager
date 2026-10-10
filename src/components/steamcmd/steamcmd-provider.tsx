import { SteamCmdContext, useSteamCmdController } from "@/hooks/use-steamcmd";

/** Shares SteamCMD status and the running download/update with the app. */
export const SteamCmdProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const value = useSteamCmdController();
  return (
    <SteamCmdContext.Provider value={value}>
      {children}
    </SteamCmdContext.Provider>
  );
};
