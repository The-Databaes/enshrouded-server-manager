fn main() {
  // The icons are baked in at compile time (the .exe resource, and the window
  // icon via `generate_context!`), but nothing tells cargo to rebuild when they
  // change, so `pnpm assets` alone would leave the old icon in the app.
  println!("cargo:rerun-if-changed=icons");
  tauri_build::build()
}
