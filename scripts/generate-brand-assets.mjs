// Rasterizes the SVG brand sources in assets/brand into every icon the app
// needs: Tauri bundle icons, web favicons, PWA manifest icons and the README
// banner.
//
//   pnpm assets
//
// One drawing can't serve both 16px and 1024px, so the icon comes in three
// variants, each used for the range where it reads:
//
//   icon-micro.svg   16–32px  cropped, no frame, brighter stone
//   icon-simple.svg  40–48px  two bays, no masonry
//   icon.svg         64px+    full detail
//
// Each size is rendered at 4x, downsampled with Lanczos, and sizes up to 64px
// get a light unsharp pass: downsampling glow-heavy art costs edge
// definition, and at 16px that's the difference between a lit tower and a
// smudge.
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
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brand = resolve(root, "assets/brand");
const pub = resolve(root, "public");
const tauriIcons = resolve(root, "src-tauri/icons");

const fontOptions = {
  loadSystemFonts: false,
  fontFiles: [resolve(brand, "fonts/Cinzel[wght].ttf")],
  defaultFontFamily: "Cinzel",
};

const variants = {
  micro: resolve(brand, "icon-micro.svg"),
  simple: resolve(brand, "icon-simple.svg"),
  detailed: resolve(brand, "icon.svg"),
};
const bannerSvg = resolve(brand, "banner.svg");

const variantFor = (size) =>
  size <= 32
    ? variants.micro
    : size <= 48
      ? variants.simple
      : variants.detailed;

/** Reads an SVG, inlining any `href="other.svg"` from assets/brand. */
function readSvg(svgPath) {
  return readFileSync(svgPath, "utf8").replace(
    /href="([\w-]+\.svg)"/g,
    (_, file) =>
      `href="data:image/svg+xml;base64,${readFileSync(resolve(brand, file)).toString("base64")}"`,
  );
}

function rasterize(svgPath, width) {
  return new Resvg(readSvg(svgPath), {
    fitTo: { mode: "width", value: width },
    font: fontOptions,
  })
    .render()
    .asPng();
}

const iconCache = new Map();

/** The app icon at `size`px, from whichever variant covers that size. */
async function icon(size, svgPath = variantFor(size)) {
  const key = `${svgPath}@${size}`;
  if (!iconCache.has(key)) {
    let image = sharp(rasterize(svgPath, Math.min(size * 4, 4096))).resize(
      size,
      size,
      { kernel: "lanczos3" },
    );
    if (size <= 64) image = image.sharpen({ sigma: 0.6, m1: 0.7, m2: 1.4 });
    iconCache.set(key, await image.png({ compressionLevel: 9 }).toBuffer());
  }
  return iconCache.get(key);
}

function write(outPath, data, note) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, data);
  console.log(`wrote ${outPath}${note ? ` (${note})` : ""}`);
}

/** A Windows .ico with PNG frames (supported since Vista). */
async function writeIco(outPath, sizes) {
  const frames = await Promise.all(sizes.map((size) => icon(size)));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size % 256, entry); // 0 means 256
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(frames[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frames[i].length;
  });
  write(outPath, Buffer.concat([header, ...frames]), `${sizes.join(", ")}px`);
}

/** A macOS .icns with PNG chunks, including the @2x (retina) types. */
async function writeIcns(outPath) {
  const types = [
    [16, "icp4"],
    [32, "icp5"],
    [64, "icp6"],
    [128, "ic07"],
    [256, "ic08"],
    [512, "ic09"],
    [1024, "ic10"],
    // 16@2x, 32@2x, 128@2x, 256@2x
    [32, "ic11"],
    [64, "ic12"],
    [256, "ic13"],
    [512, "ic14"],
  ];
  const chunks = await Promise.all(
    types.map(async ([size, type]) => {
      const png = await icon(size);
      const head = Buffer.alloc(8);
      head.write(type, 0, "ascii");
      head.writeUInt32BE(png.length + 8, 4);
      return Buffer.concat([head, png]);
    }),
  );
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(body.length + 8, 4);
  write(outPath, Buffer.concat([head, body]));
}

// Master raster, used by `tauri icon` for its large PNG sets.
write(resolve(brand, "icon-1024.png"), await icon(1024), "1024px");

// Web / PWA.
write(resolve(pub, "logo512.png"), await icon(512), "512px");
write(resolve(pub, "logo192.png"), await icon(192), "192px");
write(resolve(pub, "apple-touch-icon.png"), await icon(180), "180px");
write(resolve(pub, "favicon-32x32.png"), await icon(32), "32px");
write(resolve(pub, "favicon-16x16.png"), await icon(16), "16px");
copyFileSync(variants.micro, resolve(pub, "favicon.svg"));
await writeIco(resolve(pub, "favicon.ico"), [16, 32, 48]);

// Banner, with the icon inlined so public/banner.svg stands alone.
write(resolve(pub, "banner.png"), rasterize(bannerSvg, 1600), "1600px");
write(resolve(pub, "banner.svg"), readSvg(bannerSvg));

// Tauri bundle icons. `tauri icon` writes the full set from the detailed
// master; then every file that holds a small size is replaced so it uses the
// simplified variants instead of a downscale of the detailed one.
execSync(
  `pnpm tauri icon "${resolve(brand, "icon-1024.png")}" -o "${tauriIcons}"`,
  { cwd: root, stdio: "inherit" },
);
for (const dir of ["android", "ios"]) {
  rmSync(resolve(tauriIcons, dir), { recursive: true, force: true });
}
write(resolve(tauriIcons, "32x32.png"), await icon(32), "32px");
write(resolve(tauriIcons, "Square30x30Logo.png"), await icon(30), "30px");
write(resolve(tauriIcons, "Square44x44Logo.png"), await icon(44), "44px");
await writeIco(resolve(tauriIcons, "icon.ico"), [16, 24, 32, 48, 64, 128, 256]);
await writeIcns(resolve(tauriIcons, "icon.icns"));
