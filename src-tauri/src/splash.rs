//! The splash window shown while the main window gets ready.
//!
//! The main window starts hidden. Its UI reports how far it has got
//! (`splash_progress`) and says when its first screen is ready
//! (`splash_ready`). Once the splash's opening has played, it plays its
//! finale, the main window appears and the splash closes. If the UI never says so (a broken build,
//! a dev server that's down), the main window is shown anyway after
//! `FALLBACK`, so the app can never sit running but invisible.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::json;
use tauri::webview::{PageLoadEvent, PageLoadPayload};
use tauri::{AppHandle, Manager, Runtime, Webview};

pub const SPLASH_LABEL: &str = "splashscreen";
pub const MAIN_LABEL: &str = "main";

/// Long enough for the splash's opening (the Flame catching, the name
/// fading in) to play.
const MIN_SHOWN: Duration = Duration::from_millis(1600);
/// The splash's closing flourish, played once the app is ready.
const FINALE: Duration = Duration::from_millis(500);
/// Show the main window regardless after this long.
const FALLBACK: Duration = Duration::from_secs(25);

/// What the UI reports while it loads, in order.
const STAGES: [&str; 3] = ["interface", "steamcmd", "server"];

pub struct Splash {
  opened_at: Instant,
  /// Set once the hand-off to the main window has begun.
  handed_off: AtomicBool,
  /// The latest stage reported, replayed if the splash page loads late.
  stage: Mutex<Option<&'static str>>,
}

impl Splash {
  pub fn new() -> Self {
    Self {
      opened_at: Instant::now(),
      handed_off: AtomicBool::new(false),
      stage: Mutex::new(None),
    }
  }
}

/// Run `script` in the splash page, if the splash is still open.
fn tell_splash<R: Runtime>(app: &AppHandle<R>, script: &str) {
  if let Some(splash) = app.get_webview_window(SPLASH_LABEL) {
    let _ = splash.eval(script);
  }
}

fn show_main<R: Runtime>(app: &AppHandle<R>) {
  if let Some(main) = app.get_webview_window(MAIN_LABEL) {
    let _ = main.show();
    let _ = main.unminimize();
    let _ = main.set_focus();
  }
  if let Some(splash) = app.get_webview_window(SPLASH_LABEL) {
    // `destroy`, not `close`: closing the splash by hand quits the app.
    let _ = splash.destroy();
  }
}

/// Let the splash finish, then swap it for the main window.
fn hand_off<R: Runtime>(app: &AppHandle<R>) {
  let splash = app.state::<Splash>();
  // Already under way, or done and the main window has just reloaded.
  if splash.handed_off.swap(true, Ordering::SeqCst) {
    return;
  }
  if app.get_webview_window(SPLASH_LABEL).is_none() {
    show_main(app);
    return;
  }
  // Fill the progress bar now, but let the opening finish before the finale.
  tell_splash(app, "window.splash?.complete()");
  let opening_left = MIN_SHOWN.saturating_sub(splash.opened_at.elapsed());
  let app = app.clone();
  tauri::async_runtime::spawn(async move {
    tokio::time::sleep(opening_left).await;
    tell_splash(&app, "window.splash?.ready()");
    tokio::time::sleep(FINALE).await;
    show_main(&app);
  });
}

/// Called from setup: the safety net if the UI never reports in.
pub fn arm_fallback<R: Runtime>(app: &AppHandle<R>) {
  let app = app.clone();
  tauri::async_runtime::spawn(async move {
    tokio::time::sleep(FALLBACK).await;
    hand_off(&app);
  });
}

/// Give the splash page what it can't know itself: the version, and how far
/// the app has already got if it loaded late.
pub fn on_page_load<R: Runtime>(webview: &Webview<R>, payload: &PageLoadPayload<'_>) {
  if webview.label() != SPLASH_LABEL || payload.event() != PageLoadEvent::Finished {
    return;
  }
  let app = webview.app_handle();
  let stage = app
    .state::<Splash>()
    .stage
    .lock()
    .map(|stage| *stage)
    .unwrap_or_default();
  let init = json!({ "version": app.package_info().version.to_string(), "stage": stage });
  let _ = webview.eval(format!("window.splash?.init({init})"));
}

/// The UI got a step further.
#[tauri::command]
pub fn splash_progress(app: AppHandle, stage: &str) {
  let Some(stage) = STAGES.into_iter().find(|known| *known == stage) else {
    return;
  };
  if let Ok(mut current) = app.state::<Splash>().stage.lock() {
    *current = Some(stage);
  }
  tell_splash(&app, &format!("window.splash?.stage({})", json!(stage)));
}

/// The UI has drawn its first real screen.
#[tauri::command]
pub fn splash_ready(app: AppHandle) {
  hand_off(&app);
}
