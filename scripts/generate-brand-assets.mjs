// Rasterizes the SVG brand sources in assets/brand into every icon the app
// needs: Tauri bundle icons (via `tauri icon`), web favicons, PWA manifest
// icons and the README banner.
//
//   pnpm assets
//
import { execSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brand = resolve(root, "assets/brand");
const pub = resolve(root, "public");
const tauriIcons = resolve(root, "src-tauri/icons");

const fontOptions = {
  loadSystemFonts: false,
  fontFiles: [resolve(brand, "fonts/Cinzel[wght].ttf")],
  defaultFontFamily: "Cinzel",
};

function renderPng(svgPath, outPath, width) {
  const svg = readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: fontOptions,
  });
  const png = resvg.render().asPng();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${width}px)`);
}

const iconSvg = resolve(brand, "icon.svg");
const bannerSvg = resolve(brand, "banner.svg");

// Master raster used as the Tauri icon source.
renderPng(iconSvg, resolve(brand, "icon-1024.png"), 1024);

// Web / PWA icons.
renderPng(iconSvg, resolve(pub, "logo512.png"), 512);
renderPng(iconSvg, resolve(pub, "logo192.png"), 192);
renderPng(iconSvg, resolve(pub, "apple-touch-icon.png"), 180);
renderPng(iconSvg, resolve(pub, "favicon-32x32.png"), 32);
renderPng(iconSvg, resolve(pub, "favicon-16x16.png"), 16);
copyFileSync(iconSvg, resolve(pub, "favicon.svg"));

// Banner.
renderPng(bannerSvg, resolve(pub, "banner.png"), 1600);
copyFileSync(bannerSvg, resolve(pub, "banner.svg"));

// Tauri bundle icons (icon.ico, icon.icns, Square*Logo.png, ...).
execSync(
  `pnpm tauri icon "${resolve(brand, "icon-1024.png")}" -o "${tauriIcons}"`,
  { cwd: root, stdio: "inherit" },
);

// Desktop only: drop the mobile icon sets Tauri also emits.
for (const dir of ["android", "ios"]) {
  rmSync(resolve(tauriIcons, dir), { recursive: true, force: true });
}

// Reuse the multi-resolution .ico Tauri produced as the browser favicon.
copyFileSync(resolve(tauriIcons, "icon.ico"), resolve(pub, "favicon.ico"));
console.log("wrote public/favicon.ico");
