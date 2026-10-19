//! The few values the manager needs from the server's own settings file,
//! `enshrouded_server.json` (next to `enshrouded_server.exe`).
//!
//! The file belongs to the server: it creates it on first start and adds new
//! settings in updates. So this only *reads* it, takes just the fields it
//! needs, and falls back to the server's documented defaults for anything
//! missing or of an unexpected type, instead of rejecting the file.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use crate::util::display;

pub const SETTINGS_FILE: &str = "enshrouded_server.json";

// Defaults from the server's readme (`enshrouded_server_readme.txt`).
const DEFAULT_NAME: &str = "Enshrouded Server";
const DEFAULT_QUERY_PORT: u16 = 15637;
const DEFAULT_SLOT_COUNT: u8 = 16;
const DEFAULT_SAVE_DIR: &str = "./savegame";
const DEFAULT_LOG_DIR: &str = "./logs";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FileState {
  /// Not created yet: the server writes it with defaults on first start.
  Missing,
  Ok,
  /// Exists but isn't valid JSON; the values shown are the defaults.
  Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSettings {
  pub file: FileState,
  /// Why the file couldn't be read, when `file` is `Invalid`.
  pub problem: Option<String>,
  pub name: String,
  /// The address the server listens on (`0.0.0.0` = every interface).
  pub ip: IpAddr,
  pub query_port: u16,
  pub slot_count: u8,
  pub save_dir: String,
  pub log_dir: String,
}

impl ServerSettings {
  /// Read the settings for the server installed in `install_dir`.
  pub fn read(install_dir: &Path) -> Self {
    let path = install_dir.join(SETTINGS_FILE);
    match std::fs::read_to_string(&path) {
      Ok(text) => {
        // Windows editors like to add a byte-order mark.
        match serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}')) {
          Ok(json) => Self::from_json(install_dir, &json),
          Err(err) => Self {
            file: FileState::Invalid,
            problem: Some(format!("{SETTINGS_FILE} isn't valid JSON: {err}")),
            ..Self::from_json(install_dir, &Value::Null)
          },
        }
      }
      Err(err) if err.kind() == std::io::ErrorKind::NotFound => Self {
        file: FileState::Missing,
        ..Self::from_json(install_dir, &Value::Null)
      },
      Err(err) => Self {
        file: FileState::Invalid,
        problem: Some(format!("Couldn't read {SETTINGS_FILE}: {err}")),
        ..Self::from_json(install_dir, &Value::Null)
      },
    }
  }

  fn from_json(install_dir: &Path, json: &Value) -> Self {
    let text = |key: &str| json.get(key).and_then(Value::as_str);
    let dir = |key: &str, default: &str| {
      display(&resolve(
        install_dir,
        text(key)
          .filter(|s| !s.trim().is_empty())
          .unwrap_or(default),
      ))
    };
    Self {
      file: FileState::Ok,
      problem: None,
      name: text("name")
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(DEFAULT_NAME)
        .to_owned(),
      ip: text("ip")
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED)),
      query_port: json
        .get("queryPort")
        .and_then(Value::as_u64)
        .and_then(|p| u16::try_from(p).ok())
        .filter(|&p| p != 0)
        .unwrap_or(DEFAULT_QUERY_PORT),
      slot_count: json
        .get("slotCount")
        .and_then(Value::as_u64)
        .and_then(|n| u8::try_from(n).ok())
        .filter(|&n| n != 0)
        .unwrap_or(DEFAULT_SLOT_COUNT),
      save_dir: dir("saveDirectory", DEFAULT_SAVE_DIR),
      log_dir: dir("logDirectory", DEFAULT_LOG_DIR),
    }
  }

  /// Where to send queries to reach the server from this machine.
  pub fn query_addr(&self) -> SocketAddr {
    let ip = if self.ip.is_unspecified() {
      match self.ip {
        IpAddr::V4(_) => IpAddr::V4(Ipv4Addr::LOCALHOST),
        IpAddr::V6(_) => IpAddr::V6(std::net::Ipv6Addr::LOCALHOST),
      }
    } else {
      self.ip
    };
    SocketAddr::new(ip, self.query_port)
  }
}

/// The server resolves relative folders against its own folder (it is
/// started from there).
fn resolve(install_dir: &Path, dir: &str) -> PathBuf {
  let path = Path::new(dir.trim());
  if path.is_absolute() {
    return path.to_path_buf();
  }
  let relative: PathBuf = path
    .components()
    .filter(|c| !matches!(c, std::path::Component::CurDir))
    .collect();
  install_dir.join(relative)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn reads_the_fields_it_needs_and_ignores_the_rest() {
    let json = serde_json::json!({
      "name": "Embervale",
      "saveDirectory": "./savegame",
      "logDirectory": "D:\\logs",
      "ip": "0.0.0.0",
      "queryPort": 15700,
      "slotCount": 8,
      "gameSettings": { "someFutureSetting": 3 },
      "aNewTopLevelSetting": [1, 2]
    });
    let dir = Path::new(r"C:\server");
    let s = ServerSettings::from_json(dir, &json);
    assert_eq!(s.name, "Embervale");
    assert_eq!(s.query_port, 15700);
    assert_eq!(s.slot_count, 8);
    assert_eq!(
      s.query_addr(),
      "127.0.0.1:15700".parse().unwrap_or_else(|_| unreachable!())
    );
    assert_eq!(PathBuf::from(&s.save_dir), dir.join("savegame"));
    if cfg!(windows) {
      assert_eq!(s.log_dir, r"D:\logs");
    }
  }

  #[test]
  fn falls_back_to_defaults_for_missing_or_unexpected_values() {
    let json = serde_json::json!({
      "name": "",
      "ip": "not an ip",
      "queryPort": "15637",
      "slotCount": 400
    });
    let s = ServerSettings::from_json(Path::new("/srv"), &json);
    assert_eq!(s.name, DEFAULT_NAME);
    assert!(s.ip.is_unspecified());
    assert_eq!(s.query_port, DEFAULT_QUERY_PORT);
    assert_eq!(s.slot_count, DEFAULT_SLOT_COUNT);
  }

  #[test]
  fn missing_and_broken_files() -> std::io::Result<()> {
    let dir = tempfile::tempdir()?;
    assert_eq!(ServerSettings::read(dir.path()).file, FileState::Missing);

    std::fs::write(
      dir.path().join(SETTINGS_FILE),
      "\u{feff}{ \"name\": \"Bom\" }",
    )?;
    let s = ServerSettings::read(dir.path());
    assert_eq!((s.file, s.name.as_str()), (FileState::Ok, "Bom"));

    std::fs::write(dir.path().join(SETTINGS_FILE), "{ \"name\": ")?;
    let s = ServerSettings::read(dir.path());
    assert_eq!(s.file, FileState::Invalid);
    assert!(s.problem.is_some());
    assert_eq!(s.query_port, DEFAULT_QUERY_PORT);
    Ok(())
  }
}
