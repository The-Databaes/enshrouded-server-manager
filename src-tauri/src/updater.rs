//! Updating the manager itself, with tauri-plugin-updater.
//!
//! The UI goes through these two commands rather than the plugin's own JS
//! API, so the order that keeps a world safe lives in one place:
//!
//! 1. download the new version and verify its signature while the server
//!    keeps running (players stay online for all of it);
//! 2. stop the server, which saves the world;
//! 3. hand over to the installer. On Windows that exits the app at once (the
//!    plugin calls `process::exit`, so `RunEvent::Exit` never fires) and the
//!    installer starts the new version when it's done.
//!
//! From the start of an install until the app exits, the SteamCMD job slot is
//! held: the server can't be started again and SteamCMD can't be halfway
//! through writing the server's files when the app goes away.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::error::{Error, Result};
use crate::server::runtime::STOP_TIMEOUT;
use crate::state::AppState;

/// A check that hasn't answered by then has failed (a captive portal, a
/// stalled proxy): better to say so than to spin forever.
const CHECK_TIMEOUT: Duration = Duration::from_secs(30);

/// Download progress is sent at most this often. The plugin reports every
/// chunk, a few KB each: forwarding them all would flood the IPC bridge.
const PROGRESS_EVERY: Duration = Duration::from_millis(100);

/// The update found by the last check, and whether one is being installed.
#[derive(Default)]
pub struct Updater {
  pending: Mutex<Option<Update>>,
  installing: AtomicBool,
}

impl Updater {
  /// While true, nothing may start the server or touch its files.
  pub fn is_installing(&self) -> bool {
    self.installing.load(Ordering::SeqCst)
  }

  fn pending(&self) -> MutexGuard<'_, Option<Update>> {
    self.pending.lock().unwrap_or_else(PoisonError::into_inner)
  }
}

/// Clears `installing` however the install ends (an error, or a panic).
struct InstallingFlag<'a>(&'a AtomicBool);

impl Drop for InstallingFlag<'_> {
  fn drop(&mut self) {
    self.0.store(false, Ordering::SeqCst);
  }
}

/// A newer version than the one running.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
  version: String,
  current_version: String,
  /// When it was published (unix ms), if the release says.
  date: Option<i64>,
  /// Release notes, as Markdown.
  notes: Option<String>,
}

impl From<&Update> for AvailableUpdate {
  fn from(update: &Update) -> Self {
    Self {
      version: update.version.clone(),
      current_version: update.current_version.clone(),
      date: update
        .date
        .map(|date| i64::try_from(date.unix_timestamp_nanos() / 1_000_000).unwrap_or_default()),
      notes: update.body.clone().filter(|notes| !notes.trim().is_empty()),
    }
  }
}

/// How an install is getting on, streamed to the UI.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum InstallEvent {
  /// `total` is missing when the server doesn't send a length.
  #[serde(rename_all = "camelCase")]
  Downloading {
    downloaded: u64,
    total: Option<u64>,
  },
  /// Downloaded and its signature checked.
  Verified,
  StoppingServer,
  /// Handing over to the installer; the app exits next.
  Installing,
}

/// Look for a newer version. `None` when this one is the latest.
#[tauri::command]
pub async fn app_update_check(
  app: AppHandle,
  state: State<'_, AppState>,
) -> Result<Option<AvailableUpdate>> {
  if state.updater.is_installing() {
    return Err(Error::Update("An update is being installed.".into()));
  }
  let update = app
    .updater_builder()
    .timeout(CHECK_TIMEOUT)
    .build()
    .map_err(update_error)?
    .check()
    .await
    .map_err(update_error)?;
  let available = update.as_ref().map(AvailableUpdate::from);
  // An install that started meanwhile keeps the update it took.
  if !state.updater.is_installing() {
    *state.updater.pending() = update;
  }
  Ok(available)
}

/// Download, verify and install the update found by the last check. On
/// Windows this doesn't return when it succeeds: the app exits and the
/// installer restarts it.
#[tauri::command]
pub async fn app_update_install(
  app: AppHandle,
  state: State<'_, AppState>,
  on_event: Channel<InstallEvent>,
) -> Result<()> {
  let updater = &state.updater;
  let Some(update) = updater.pending().clone() else {
    return Err(Error::Update(
      "There's no update to install. Check for updates again.".into(),
    ));
  };
  if updater.installing.swap(true, Ordering::SeqCst) {
    return Err(Error::Update(
      "The update is already being installed.".into(),
    ));
  }
  let _installing = InstallingFlag(&updater.installing);
  let _job = state.steamcmd_job.start().map_err(|error| match error {
    Error::Busy => {
      Error::Update("SteamCMD is busy. Update the manager once its task has finished.".into())
    }
    error => error,
  })?;

  let bytes = download(&update, &on_event).await?;
  let _ = on_event.send(InstallEvent::Verified);

  // A development build would install the released app over itself.
  if cfg!(debug_assertions) {
    return Err(Error::Update(
      "This is a development build, so the update was downloaded and verified but not installed."
        .into(),
    ));
  }

  if state.runtime.is_active() {
    let _ = on_event.send(InstallEvent::StoppingServer);
    state.runtime.shut_down(STOP_TIMEOUT).await;
  }

  let _ = on_event.send(InstallEvent::Installing);
  update.install(&bytes).map_err(update_error)?;
  // Windows never gets here: the installer has taken over and the app has
  // exited. Elsewhere the new version is in place and needs a restart.
  app.restart()
}

async fn download(update: &Update, on_event: &Channel<InstallEvent>) -> Result<Vec<u8>> {
  let mut downloaded: u64 = 0;
  let mut last_sent: Option<Instant> = None;
  update
    .download(
      |chunk, total| {
        downloaded = downloaded.saturating_add(u64::try_from(chunk).unwrap_or(u64::MAX));
        if last_sent.is_none_or(|at| at.elapsed() >= PROGRESS_EVERY) {
          last_sent = Some(Instant::now());
          let _ = on_event.send(InstallEvent::Downloading { downloaded, total });
        }
      },
      || {},
    )
    .await
    .map_err(update_error)
}

/// The plugin's errors, in words a server owner can act on.
fn update_error(error: tauri_plugin_updater::Error) -> Error {
  use tauri_plugin_updater::Error as E;
  match error {
    E::ReleaseNotFound => Error::UpdateNoRelease("No release of the manager has been published yet.".into()),
    E::Reqwest(_) | E::Network(_) => Error::UpdateOffline(
      "Couldn't reach the update server. Check your internet connection, then try again.".into(),
    ),
    E::Minisign(_)
    | E::Base64(_)
    | E::SignatureUtf8(_)
    | E::SignedVersionMismatch { .. }
    | E::MissingSignedVersion => Error::UpdateVerification(
      "The download didn't match its signature, so it wasn't installed. Your current version is untouched.".into(),
    ),
    E::TargetNotFound(_) | E::TargetsNotFound(_) => {
      Error::Update("The latest release doesn't include a Windows build.".into())
    }
    error => Error::Update(format!("Couldn't update the manager: {error}")),
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use tauri_plugin_updater::Error as E;

  fn kind(error: tauri_plugin_updater::Error) -> String {
    serde_json::to_value(update_error(error)).unwrap_or_default()["kind"]
      .as_str()
      .unwrap_or_default()
      .to_owned()
  }

  #[test]
  fn tells_no_release_apart_from_being_offline() {
    // A 404 from the endpoint (nothing published, or the repo is private).
    assert_eq!(kind(E::ReleaseNotFound), "updateNoRelease");
    assert_eq!(kind(E::Network("connection reset".into())), "updateOffline");
  }

  #[test]
  fn a_release_without_a_windows_build_is_a_plain_failure() {
    assert_eq!(kind(E::TargetNotFound("windows-x86_64".into())), "update");
    assert_eq!(kind(E::InsecureTransportProtocol), "update");
  }

  #[test]
  fn progress_events_match_the_ui_types() {
    let event = InstallEvent::Downloading {
      downloaded: 10,
      total: None,
    };
    assert_eq!(
      serde_json::to_value(event).unwrap_or_default(),
      serde_json::json!({ "event": "downloading", "data": { "downloaded": 10, "total": null } })
    );
    assert_eq!(
      serde_json::to_value(InstallEvent::StoppingServer).unwrap_or_default(),
      serde_json::json!({ "event": "stoppingServer" })
    );
  }
}
