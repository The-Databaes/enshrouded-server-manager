//! Persistent app settings, stored as `config.json` in the app data folder
//! (`~/.enshrouded-server-manager`).

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use serde::{Deserialize, Serialize};

use crate::error::{IoContext, Result};

const CONFIG_FILE: &str = "config.json";
const CONFIG_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppConfig {
  /// Schema version, so later releases can migrate older files.
  pub version: u32,
  /// `None` until the user has either downloaded SteamCMD or pointed us at an
  /// existing install.
  pub steamcmd: Option<SteamCmdConfig>,
  /// `None` until the user has picked where the dedicated server lives.
  pub server: Option<ServerConfig>,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      version: CONFIG_VERSION,
      steamcmd: None,
      server: None,
    }
  }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamCmdConfig {
  /// Full path to `steamcmd.exe`.
  pub executable: PathBuf,
  /// `true` when the app downloaded SteamCMD into its own data folder and is
  /// therefore allowed to update, repair and delete it.
  pub managed: bool,
  /// Unix seconds of the last successful install/self-update we ran.
  #[serde(default)]
  pub last_updated_at: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
  /// Folder SteamCMD installs the dedicated server into
  /// (`+force_install_dir`).
  pub install_dir: PathBuf,
  /// Unix seconds of the last successful `app_update … validate`.
  #[serde(default)]
  pub last_verified_at: Option<u64>,
  /// Newest public build Steam reported at the last update check.
  #[serde(default)]
  pub latest_build_id: Option<String>,
  #[serde(default)]
  pub last_checked_at: Option<u64>,
}

/// In-memory copy of the config plus the file it is persisted to. Every
/// mutation goes through [`ConfigStore::update`], which writes to disk first
/// and only then commits the change in memory.
pub struct ConfigStore {
  path: PathBuf,
  current: Mutex<AppConfig>,
}

impl ConfigStore {
  /// Load `config.json` from `dir`, starting fresh if it doesn't exist. A file
  /// that can't be parsed is moved aside to `config.json.corrupt` rather than
  /// stopping the app from launching.
  pub fn load(dir: &Path) -> Result<Self> {
    let path = dir.join(CONFIG_FILE);
    let config = match fs::read_to_string(&path) {
      Ok(text) => match serde_json::from_str::<AppConfig>(&text) {
        Ok(config) => config,
        Err(err) => {
          eprintln!(
            "config: {} is unreadable ({err}); starting fresh",
            path.display()
          );
          let aside = path.with_extension("json.corrupt");
          fs::rename(&path, &aside).at("move aside", &path)?;
          AppConfig::default()
        }
      },
      Err(err) if err.kind() == std::io::ErrorKind::NotFound => AppConfig::default(),
      Err(err) => return Err(err).at("read", &path),
    };
    Ok(Self {
      path,
      current: Mutex::new(config),
    })
  }

  pub fn get(&self) -> AppConfig {
    self.lock().clone()
  }

  pub fn update(&self, change: impl FnOnce(&mut AppConfig)) -> Result<AppConfig> {
    let mut guard = self.lock();
    let mut next = guard.clone();
    change(&mut next);
    next.version = CONFIG_VERSION;
    write_atomic(&self.path, &serde_json::to_vec_pretty(&next)?)?;
    *guard = next.clone();
    Ok(next)
  }

  fn lock(&self) -> std::sync::MutexGuard<'_, AppConfig> {
    // A panic while holding the lock can't leave the config half-written
    // (we swap in a fully built value), so a poisoned lock is still usable.
    self.current.lock().unwrap_or_else(PoisonError::into_inner)
  }
}

/// Write via a temp file + rename so a crash never leaves a truncated config.
fn write_atomic(path: &Path, contents: &[u8]) -> Result<()> {
  if let Some(dir) = path.parent() {
    fs::create_dir_all(dir).at("create", dir)?;
  }
  let tmp = path.with_extension("json.tmp");
  fs::write(&tmp, contents).at("write", &tmp)?;
  fs::rename(&tmp, path).at("replace", path)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn missing_file_gives_defaults() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    let store = ConfigStore::load(dir.path())?;
    assert_eq!(store.get(), AppConfig::default());
    assert!(
      !dir.path().join(CONFIG_FILE).exists(),
      "loading must not write"
    );
    Ok(())
  }

  #[test]
  fn update_round_trips_through_disk() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    let store = ConfigStore::load(dir.path())?;
    let steamcmd = SteamCmdConfig {
      executable: PathBuf::from(r"C:\steamcmd\steamcmd.exe"),
      managed: false,
      last_updated_at: Some(42),
    };
    store.update(|c| c.steamcmd = Some(steamcmd.clone()))?;

    let reloaded = ConfigStore::load(dir.path())?;
    assert_eq!(reloaded.get().steamcmd, Some(steamcmd));
    Ok(())
  }

  #[test]
  fn corrupt_file_is_moved_aside() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    fs::write(dir.path().join(CONFIG_FILE), "{ not json").at("write", dir.path())?;

    let store = ConfigStore::load(dir.path())?;
    assert_eq!(store.get(), AppConfig::default());
    assert!(dir.path().join("config.json.corrupt").exists());
    Ok(())
  }

  #[test]
  fn unknown_and_missing_fields_are_tolerated() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    fs::write(
      dir.path().join(CONFIG_FILE),
      r#"{ "futureSetting": true, "steamcmd": { "executable": "x", "managed": true } }"#,
    )
    .at("write", dir.path())?;

    let config = ConfigStore::load(dir.path())?.get();
    assert_eq!(config.version, CONFIG_VERSION);
    assert_eq!(config.steamcmd.map(|s| s.last_updated_at), Some(None));
    Ok(())
  }
}
