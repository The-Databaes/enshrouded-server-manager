# Enshrouded Server Manager

![Enshrouded Server Manager banner](public/banner.png)

A desktop manager for [Enshrouded](https://enshrouded.com/) dedicated servers,
built with Tauri 2 and TanStack Start.

## SteamCMD

The manager needs [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD) to download and
update the Enshrouded server. Valve's licence doesn't allow bundling it, so on first launch the app
shows a setup screen that either downloads it from Valve into the app data folder (and keeps it
updated) or points at an existing install. It can be updated, changed or removed later under
**Settings**.

Everything the app stores lives in `~/.enshrouded-server-manager` (e.g.
`C:\Users\you\.enshrouded-server-manager`): `config.json`, the app-downloaded SteamCMD in
`steamcmd\` and, unless you pick another folder, the server files.

The **Servers** page installs the Enshrouded Dedicated Server (Steam app 2278520, anonymous
login) with SteamCMD, and can check for updates, update and verify it. Point it at a folder that
already has the server and it is verified and adopted instead of downloaded again.

SteamCMD runs inside a pseudo-console (ConPTY) so its output streams live: with plain pipes it
buffers everything until it exits. Every job shows parsed progress (bytes, speed, %) plus the raw
**live console**.

Outside the Tauri window (`pnpm dev:vite`), these calls are answered by browser-only stand-ins
(`src/lib/steamcmd/mock.ts`, `src/lib/server/mock.ts`). Seed them with
`?mockSteamcmd=ready|external|missing` and `?mockServer=installed|update|incomplete`.
To run a real download test from Rust: `cargo test -- --ignored live_install --nocapture`.

## Design system

The UI is built on [shadcn/ui](https://ui.shadcn.com/) (every component is installed under
`src/components/ui`) with an Enshrouded-inspired theme defined in `src/styles.css`:

- **Dark** (default): the violet void between the spires, ember-gold actions and shroud-violet
  mist.
- **Light**: sunlit parchment with the same gold and violet, darkened to hold text.

Both themes are selectable from the header toggle (light / dark / system). Gold (`primary`) is the
affirmative action and nothing else. Status colours are semantic: `success` (healthy), `info`
(in transition), `warning` (needs attention) and `destructive` (failed), with matching `Badge`,
`Alert` and `Progress` variants. Brand colours are Tailwind utilities too: `ember`, `shroud`,
`firelight` and `stone` (e.g. `bg-ember`, `text-shroud`), plus the `shadow-stone`,
`shadow-ember` and `shadow-shroud` elevations. Headings and titles use Cinzel, UI text uses
Barlow, logs use JetBrains Mono.

Open the **Design System** page inside the app to browse every component in both themes.

### Brand assets

Sources live in `assets/brand`. One drawing can't serve both 16px and 1024px, so the icon
comes in three variants, each used for the range where it reads:

| Sizes  | Source            | Why                                                                   |
| ------ | ----------------- | --------------------------------------------------------------------- |
| 16–32  | `icon-micro.svg`  | Cropped in, no frame, brighter stone: a 1px gold ring is noise here   |
| 40–48  | `icon-simple.svg` | Two bays, no masonry: finer detail merges into a smudge               |
| 64+    | `icon.svg`        | Full detail                                                           |

`banner.svg` embeds `icon.svg`. Regenerate everything derived from them (Tauri bundle
icons incl. `.ico`/`.icns`, favicons, PWA icons, `public/banner.png`) with:

```sh
pnpm assets
```

Each size is rendered at 4x, downsampled with Lanczos, and sizes up to 64px get a light
unsharp pass so the small icons keep their edges. In the app, `LogoMark` takes the same
`variant` (`micro` / `simple` / `detailed`) for the size it's shown at.

---

The sections below come from the original project template.

This is a [Tauri 2.0](https://v2.tauri.app/) project template using [TanStack Start](https://tanstack.com/start/latest),
bootstrapped by combining [`create @tanstack/start`](https://tanstack.com/start/latest/docs/framework/react/quick-start)
and [`create tauri-app`](https://v2.tauri.app/start/create-project/).

This template uses [`pnpm`](https://pnpm.io/) as the Node.js dependency
manager, and uses [TanStack Router](https://tanstack.com/router/latest) with type-safe file-based routing.

## Template Features

- TypeScript frontend using [TanStack Start](https://tanstack.com/start/latest) with [Vite](https://vite.dev/) and [React 19](https://github.com/facebook/react)
- [TanStack Router](https://tanstack.com/router/latest) with type-safe file-based routing
- [TailwindCSS 4](https://tailwindcss.com/) as a utility-first atomic CSS framework
  - While not included by default, consider using
    [React Aria components](https://react-spectrum.adobe.com/react-aria/index.html)
    and/or [HeadlessUI components](https://headlessui.com/) for completely unstyled and
    fully accessible UI components, which integrate nicely with TailwindCSS
- [Vitest](https://vitest.dev/) for unit testing with [Testing Library](https://testing-library.com/)
- Opinionated formatting and linting already setup and enabled
  - [Biome](https://biomejs.dev/) for fast formatting, linting, and import sorting of TypeScript code
  - [clippy](https://github.com/rust-lang/rust-clippy) and
    [rustfmt](https://github.com/rust-lang/rustfmt) for Rust code
- GitHub Actions to check code formatting and linting for both TypeScript and Rust

## Getting Started

### Running development server and use Tauri window

After cloning for the first time, change your app identifier inside
`src-tauri/tauri.conf.json` to your own:

```jsonc
{
  // ...
  // The default "com.tauri.dev" will prevent you from building in release mode
  "identifier": "com.my-application-name.app",
  // ...
}
```

To develop and run the frontend in a Tauri window:

```shell
pnpm tauri dev
```

This will load the TanStack Start frontend directly in a Tauri webview window, in addition to
starting a development server on `localhost:3000`.
Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> in a Chromium based WebView (e.g. on
Windows) to open the web developer console from the Tauri window.

### Building for release

To build the TanStack Start frontend and the Tauri application for release:

```shell
pnpm tauri build
```

### Running tests

```shell
pnpm test
```

### Source structure

TanStack Start frontend source files are located in `src/` and Tauri Rust application source
files are located in `src-tauri/`. Please consult the TanStack Start and Tauri documentation
respectively for questions pertaining to either technology.

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing.
Routes are managed as files in `src/routes/`.

### Adding a Route

To add a new route, create a new file in the `./src/routes` directory.
TanStack Router will automatically generate the route configuration.

### Adding Links

Use the `Link` component from `@tanstack/react-router` for SPA navigation:

```tsx
import { Link } from "@tanstack/react-router";

<Link to="/about">About</Link>
```

### Using a Layout

The root layout is located in `src/routes/__root.tsx`. Content added to the root route
will appear in all routes. Use the `<Outlet />` component to render child routes.

More information on layouts can be found in the
[TanStack Router Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/outlets).

## Prerendering

TanStack Start uses prerendering to generate static HTML files at build time. This is essential for Tauri since:

1. **Tauri serves static files** - Tauri loads your frontend from the local filesystem, not from a running server
2. **No Node.js runtime** - Unlike a traditional web app, there's no backend server to handle SSR at runtime
3. **Instant loading** - Prerendered HTML loads immediately without waiting for JavaScript to hydrate

### Prerender Modes

The template supports two prerendering modes, controlled by the `USE_SSR_PRERENDER_MODE` environment variable in [vite.config.ts](vite.config.ts):

| Mode              | Env Variable           | Behavior                                                                         |
| ----------------- | ---------------------- | -------------------------------------------------------------------------------- |
| **SPA (default)** | unset, `false`, or `0` | Outputs a single `/index.html` with client-side routing to handle SPA navigation |
| **SSR Prerender** | `true` or `1`          | Crawls links and tries to generate an HTML file per route                        |

To enable SSR prerendering instead, set the environment variable before building:

```shell
USE_SSR_PRERENDER_MODE=true pnpm tauri build
```

For most Tauri apps, the default SPA mode is sufficient and simpler. Use the SSR prerendering mode if you also expect your app to be deployed as a website to allow for improved SEO on a per-route basis.

## Caveats

### `TypeError: can't access property "invoke", window.__TAURI_INTERNALS__ is undefined`

This error occurs when Tauri APIs (like `invoke`) are called outside of Tauri's webview context. When Tauri launches your app, it runs your frontend inside a native webview (WebView2 on Windows, WebKit on macOS/Linux). During initialization, Tauri injects a `__TAURI_INTERNALS__` object into the webview's global `window` variable. This object contains the IPC bridge that enables communication between your frontend and the Rust backend (including the `invoke` function).

You may encounter this error if you:

- Open the dev server URL directly in a standalone browser
- Import Tauri APIs at the module level during SSR/prerendering (Node.js context)
- Run code that accesses Tauri APIs before the webview has fully initialized

For Tauri apps, always try to develop via Tauri's webview instead of opening the URL in a browser directly. Additionally, guarded Tauri API calls or dynamic imports can be used in the frontend code to avoid this issue in SSR contexts.

## Learn More

To learn more about TanStack Start and Router, take a look at the following resources:

- [TanStack Start Documentation](https://tanstack.com/start/latest) - learn about TanStack Start features
- [TanStack Router Documentation](https://tanstack.com/router/latest) - learn about routing

And to learn more about Tauri, take a look at the following resources:

- [Tauri Documentation - Guides](https://v2.tauri.app/start/) - learn about the Tauri toolkit
