import { TitleBar } from "@/components/app-shell/title-bar";
import { APP_VIEWPORT_ID } from "@/components/app-shell/window-frame-ids";

/** Custom title bar on top, scrollable app content below it. */
export const WindowFrame = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <TitleBar />
      <div
        id={APP_VIEWPORT_ID}
        data-scroll-restoration-id={APP_VIEWPORT_ID}
        className="atmosphere relative min-h-0 flex-1 overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
};
