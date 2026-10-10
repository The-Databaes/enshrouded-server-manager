use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;

use super::install;
use super::locate;
use super::SteamCmdEvent;
use crate::config::SteamCmdConfig;
use crate::error::{Error, IoContext, Result};
use crate::state::AppState;
use crate::util::{display, now};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Availability {
  /// Never set up: the first-run screen should be shown.
  NotConfigured,
  /// Configured and the executable is on disk.
  Ready,
  /// Configured, but the executable has since been moved or deleted.
  Missing,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamCmdStatus {
  pub availability: Availability,
  pub executable: Option<String>,
  pub managed: bool,
  pub last_updated_at: Option<u64>,
  /// Where "Download for me" installs to.
  pub managed_dir: String,
  /// Whether a download/update is running right now.
  pub busy: bool,
  /// Automatic download is only implemented for Windows.
  pub can_download: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathCheck {
  pub executable: Option<String>,
  pub error: Option<String>,
}

fn status(state: &AppState) -> SteamCmdStatus {
  let steamcmd = state.config.get().steamcmd;
  let availability = match &steamcmd {
    None => Availability::NotConfigured,
    Some(s) if s.executable.is_file() => Availability::Ready,
    Some(_) => Availability::Missing,
  };
  SteamCmdStatus {
    availability,
    executable: steamcmd.as_ref().map(|s| display(&s.executable)),
    managed: steamcmd.as_ref().is_some_and(|s| s.managed),
    last_updated_at: steamcmd.as_ref().and_then(|s| s.last_updated_at),
    managed_dir: display(&state.managed_steamcmd_dir()),
    busy: state.steamcmd_job.is_busy(),
    can_download: cfg!(windows),
  }
}

#[tauri::command]
pub fn steamcmd_status(state: State<'_, AppState>) -> SteamCmdStatus {
  status(&state)
}

/// Validate a folder or file the user picked, without saving anything.
#[tauri::command]
pub fn steamcmd_inspect(path: &str) -> PathCheck {
  match locate::resolve_executable(Path::new(path.trim())) {
    Ok(exe) => PathCheck {
      executable: Some(display(&exe)),
      error: None,
    },
    Err(error) => PathCheck {
      executable: None,
      error: Some(error),
    },
  }
}

/// Existing SteamCMD installs found in common locations.
#[tauri::command]
pub fn steamcmd_detect(state: State<'_, AppState>) -> Vec<String> {
  locate::detect(&state.managed_steamcmd_dir())
    .iter()
    .map(|p| display(p))
    .collect()
}

/// Remember an existing SteamCMD install chosen by the user.
#[tauri::command]
pub fn steamcmd_adopt_existing(state: State<'_, AppState>, path: &str) -> Result<SteamCmdStatus> {
  let job = state.steamcmd_job.start()?;
  let exe = locate::resolve_executable(Path::new(path.trim())).map_err(Error::InvalidPath)?;
  // Picking the copy we downloaded ourselves keeps it app-managed.
  let managed = exe
    .parent()
    .is_some_and(|dir| locate::same_path(dir, &state.managed_steamcmd_dir()));
  state.config.update(|c| {
    c.steamcmd = Some(SteamCmdConfig {
      executable: exe,
      managed,
      last_updated_at: None,
    });
  })?;
  drop(job);
  Ok(status(&state))
}

/// Download SteamCMD into the app data folder and make it the configured
/// install. Also used to repair/reinstall an app-managed copy.
#[tauri::command]
pub async fn steamcmd_install(
  state: State<'_, AppState>,
  on_event: Channel<SteamCmdEvent>,
) -> Result<SteamCmdStatus> {
  if !cfg!(windows) {
    return Err(Error::Unsupported(
      "Automatic download is only available on Windows. Install SteamCMD yourself and choose its folder instead.".into(),
    ));
  }
  let job = state.steamcmd_job.start()?;
  let exe = install::install(&state.managed_steamcmd_dir(), &job.token, &|event| {
    let _ = on_event.send(event);
  })
  .await?;
  state.config.update(|c| {
    c.steamcmd = Some(SteamCmdConfig {
      executable: exe,
      managed: true,
      last_updated_at: Some(now()),
    });
  })?;
  drop(job);
  Ok(status(&state))
}

/// Let the configured SteamCMD update itself.
#[tauri::command]
pub async fn steamcmd_update(
  state: State<'_, AppState>,
  on_event: Channel<SteamCmdEvent>,
) -> Result<SteamCmdStatus> {
  let job = state.steamcmd_job.start()?;
  let exe = configured_executable(&state)?;
  install::self_update(&exe, &job.token, &|event| {
    let _ = on_event.send(event);
  })
  .await?;
  state.config.update(|c| {
    if let Some(s) = c.steamcmd.as_mut() {
      s.last_updated_at = Some(now());
    }
  })?;
  drop(job);
  Ok(status(&state))
}

/// Cancel whatever download/update is running (no-op if none).
#[tauri::command]
pub fn steamcmd_cancel(state: State<'_, AppState>) {
  state.steamcmd_job.cancel();
}

/// Forget the configured SteamCMD. With `delete_files`, an app-managed copy is
/// also removed from disk; a user's own install is never deleted.
#[tauri::command]
pub fn steamcmd_forget(state: State<'_, AppState>, delete_files: bool) -> Result<SteamCmdStatus> {
  let job = state.steamcmd_job.start()?;
  let managed = state.config.get().steamcmd.is_some_and(|s| s.managed);
  if delete_files && managed {
    let dir = state.managed_steamcmd_dir();
    match std::fs::remove_dir_all(&dir) {
      Err(e) if e.kind() != std::io::ErrorKind::NotFound => {
        return Err(e).at("delete", &dir);
      }
      _ => {}
    }
  }
  state.config.update(|c| c.steamcmd = None)?;
  drop(job);
  Ok(status(&state))
}

/// The SteamCMD executable to run, or a friendly error if it isn't set up.
pub(crate) fn configured_executable(state: &AppState) -> Result<PathBuf> {
  let Some(steamcmd) = state.config.get().steamcmd else {
    return Err(Error::InvalidPath(
      "SteamCMD hasn't been set up yet.".into(),
    ));
  };
  if !steamcmd.executable.is_file() {
    return Err(Error::InvalidPath(format!(
      "SteamCMD is no longer at {}.",
      steamcmd.executable.display()
    )));
  }
  Ok(steamcmd.executable)
}
