use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;

use super::{app_update, latest_build, Manifest, APP_ID, SERVER_EXECUTABLE};
use crate::config::ServerConfig;
use crate::error::{Error, IoContext, Result};
use crate::state::AppState;
use crate::steamcmd::commands::configured_executable;
use crate::steamcmd::SteamCmdEvent;
use crate::util::{display, now};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallState {
  /// No install folder chosen yet.
  NotInstalled,
  /// The server files are present and SteamCMD finished installing them.
  Installed,
  /// A folder is configured but the install is missing or didn't finish.
  Incomplete,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
  pub state: InstallState,
  pub app_id: &'static str,
  pub install_dir: Option<String>,
  /// Suggested folder for a new install.
  pub default_install_dir: String,
  pub build_id: Option<String>,
  pub size_on_disk: Option<u64>,
  /// When SteamCMD last changed the files (from the app manifest).
  pub last_updated_at: Option<u64>,
  pub last_verified_at: Option<u64>,
  pub latest_build_id: Option<String>,
  pub last_checked_at: Option<u64>,
  /// Known only after an update check.
  pub update_available: Option<bool>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FolderKind {
  /// Already holds an Enshrouded server; it will be verified and adopted.
  ExistingInstall,
  /// Empty or doesn't exist yet: a fresh install.
  Empty,
  /// Has other files in it; the server can still go there.
  NotEmpty,
  Invalid,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderCheck {
  pub kind: FolderKind,
  pub message: String,
  pub build_id: Option<String>,
}

fn default_install_dir(state: &AppState) -> PathBuf {
  state.data_dir.join("server")
}

fn status(state: &AppState) -> ServerStatus {
  let server = state.config.get().server;
  let manifest = server
    .as_ref()
    .and_then(|s| Manifest::read(&s.install_dir))
    .unwrap_or_default();
  let installed = server
    .as_ref()
    .is_some_and(|s| s.install_dir.join(SERVER_EXECUTABLE).is_file() && manifest.is_complete());
  let state_kind = match (&server, installed) {
    (None, _) => InstallState::NotInstalled,
    (Some(_), true) => InstallState::Installed,
    (Some(_), false) => InstallState::Incomplete,
  };
  let latest = server.as_ref().and_then(|s| s.latest_build_id.clone());
  ServerStatus {
    state: state_kind,
    app_id: APP_ID,
    install_dir: server.as_ref().map(|s| display(&s.install_dir)),
    default_install_dir: display(&default_install_dir(state)),
    update_available: match (&manifest.build_id, &latest) {
      (Some(have), Some(want)) if installed => Some(have != want),
      _ => None,
    },
    build_id: manifest.build_id,
    size_on_disk: manifest.size_on_disk,
    last_updated_at: manifest.last_updated,
    last_verified_at: server.as_ref().and_then(|s| s.last_verified_at),
    latest_build_id: latest,
    last_checked_at: server.as_ref().and_then(|s| s.last_checked_at),
  }
}

fn check_folder(state: &AppState, input: &str) -> FolderCheck {
  let invalid = |message: &str| FolderCheck {
    kind: FolderKind::Invalid,
    message: message.to_owned(),
    build_id: None,
  };
  let path = Path::new(input.trim());
  if path.as_os_str().is_empty() {
    return invalid("Choose a folder for the server files.");
  }
  if !path.is_absolute() {
    return invalid("Use a full path, e.g. D:\\Enshrouded Server.");
  }
  if path.is_file() {
    return invalid("That's a file. Choose a folder.");
  }
  let steamcmd_dir = state
    .config
    .get()
    .steamcmd
    .and_then(|s| s.executable.parent().map(Path::to_path_buf));
  if steamcmd_dir.is_some_and(|d| inside(path, &d)) {
    return invalid("Keep the server outside SteamCMD's own folder.");
  }
  if path.join(SERVER_EXECUTABLE).is_file() {
    let build_id = Manifest::read(path).and_then(|m| m.build_id);
    return FolderCheck {
      kind: FolderKind::ExistingInstall,
      message: match &build_id {
        Some(b) => format!("Existing server found (build {b}). Its files will be verified."),
        None => "Existing server found. Its files will be verified.".into(),
      },
      build_id,
    };
  }
  let empty = std::fs::read_dir(path).map_or(true, |mut d| d.next().is_none());
  if empty {
    FolderCheck {
      kind: FolderKind::Empty,
      message: "The server will be installed here.".into(),
      build_id: None,
    }
  } else {
    FolderCheck {
      kind: FolderKind::NotEmpty,
      message:
        "This folder already has other files in it. The server files will be added alongside them."
          .into(),
      build_id: None,
    }
  }
}

/// Whether `path` is `dir` or somewhere inside it (case-insensitive on
/// Windows).
fn inside(path: &Path, dir: &Path) -> bool {
  let norm = |p: &Path| {
    let s = p.to_string_lossy().replace('/', "\\");
    let s = s.trim_end_matches('\\').to_owned();
    if cfg!(windows) {
      s.to_lowercase()
    } else {
      s
    }
  };
  let (p, d) = (norm(path), norm(dir));
  p == d || p.starts_with(&format!("{d}\\"))
}

fn configured_dir(state: &AppState) -> Result<PathBuf> {
  state
    .config
    .get()
    .server
    .map(|s| s.install_dir)
    .ok_or_else(|| Error::InvalidPath("Choose where to install the server first.".into()))
}

fn sender(channel: &Channel<SteamCmdEvent>) -> impl Fn(SteamCmdEvent) + '_ {
  move |event| {
    let _ = channel.send(event);
  }
}

#[tauri::command]
pub fn server_status(state: State<'_, AppState>) -> ServerStatus {
  status(&state)
}

#[tauri::command]
pub fn server_inspect_folder(state: State<'_, AppState>, path: &str) -> FolderCheck {
  check_folder(&state, path)
}

/// Install the server into `path` (or adopt and verify an existing install
/// there) and remember the folder.
#[tauri::command]
pub async fn server_install(
  state: State<'_, AppState>,
  path: String,
  on_event: Channel<SteamCmdEvent>,
) -> Result<ServerStatus> {
  let job = state.steamcmd_job.start()?;
  let check = check_folder(&state, &path);
  if matches!(check.kind, FolderKind::Invalid) {
    return Err(Error::InvalidPath(check.message));
  }
  let steamcmd = configured_executable(&state)?;
  let dir = PathBuf::from(path.trim());
  std::fs::create_dir_all(&dir).at("create", &dir)?;

  // Remember the folder straight away so an interrupted install can resume.
  state.config.update(|c| {
    let same = c.server.as_ref().is_some_and(|s| s.install_dir == dir);
    if !same {
      c.server = Some(ServerConfig {
        install_dir: dir.clone(),
        last_verified_at: None,
        latest_build_id: None,
        last_checked_at: None,
      });
    }
  })?;

  app_update(&steamcmd, &dir, true, &job.token, &sender(&on_event)).await?;
  record_success(&state, true)?;
  drop(job);
  Ok(status(&state))
}

/// Download the latest build, if there is one.
#[tauri::command]
pub async fn server_update(
  state: State<'_, AppState>,
  on_event: Channel<SteamCmdEvent>,
) -> Result<ServerStatus> {
  let job = state.steamcmd_job.start()?;
  let (steamcmd, dir) = (configured_executable(&state)?, configured_dir(&state)?);
  app_update(&steamcmd, &dir, false, &job.token, &sender(&on_event)).await?;
  record_success(&state, false)?;
  drop(job);
  Ok(status(&state))
}

/// Check every file against Steam and repair anything missing or changed.
#[tauri::command]
pub async fn server_verify(
  state: State<'_, AppState>,
  on_event: Channel<SteamCmdEvent>,
) -> Result<ServerStatus> {
  let job = state.steamcmd_job.start()?;
  let (steamcmd, dir) = (configured_executable(&state)?, configured_dir(&state)?);
  app_update(&steamcmd, &dir, true, &job.token, &sender(&on_event)).await?;
  record_success(&state, true)?;
  drop(job);
  Ok(status(&state))
}

/// Ask Steam for the newest build without downloading anything.
#[tauri::command]
pub async fn server_check_update(
  state: State<'_, AppState>,
  on_event: Channel<SteamCmdEvent>,
) -> Result<ServerStatus> {
  let job = state.steamcmd_job.start()?;
  configured_dir(&state)?;
  let steamcmd = configured_executable(&state)?;
  let (build, _) = latest_build(&steamcmd, &job.token, &sender(&on_event)).await?;
  state.config.update(|c| {
    if let Some(s) = c.server.as_mut() {
      s.latest_build_id = Some(build);
      s.last_checked_at = Some(now());
    }
  })?;
  drop(job);
  Ok(status(&state))
}

/// Stop managing the server folder. Its files are left untouched.
#[tauri::command]
pub fn server_forget(state: State<'_, AppState>) -> Result<ServerStatus> {
  let job = state.steamcmd_job.start()?;
  state.config.update(|c| c.server = None)?;
  drop(job);
  Ok(status(&state))
}

/// After a successful `app_update` the install is, by definition, the latest
/// build, so record that alongside the verification time.
fn record_success(state: &AppState, validated: bool) -> Result<()> {
  state.config.update(|c| {
    if let Some(s) = c.server.as_mut() {
      let manifest = Manifest::read(&s.install_dir).unwrap_or_default();
      s.latest_build_id = manifest.build_id;
      s.last_checked_at = Some(now());
      if validated {
        s.last_verified_at = Some(now());
      }
    }
  })?;
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[cfg(windows)]
  #[test]
  fn inside_matches_folder_and_children_only() {
    let d = Path::new(r"C:\steamcmd");
    assert!(inside(Path::new(r"C:\SteamCMD"), d));
    assert!(inside(Path::new(r"c:\steamcmd\server"), d));
    assert!(!inside(Path::new(r"C:\steamcmd-server"), d));
  }
}
