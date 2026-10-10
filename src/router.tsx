import { createRouter } from "@tanstack/react-router";

import { APP_VIEWPORT_ID } from "@/components/app-shell/window-frame-ids";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},

    scrollRestoration: true,
    // Pages scroll inside #app-viewport (under the custom title bar), not the window.
    scrollToTopSelectors: [`#${APP_VIEWPORT_ID}`],
    defaultPreloadStaleTime: 0,
  });

  return router;
};
