//! Editing `enshrouded_server.json`.
//!
//! The UI sends *changes* (set this key, remove that ban), not a whole new
//! file. They're applied to the file as it is on disk at save time, so
//! everything else in it is kept exactly as it was: settings a newer server
//! added that this version of the manager doesn't know, values the server
//! itself wrote since the editor opened (bans made in-game), and key order.
//!
//! What the server does with the file (measured on the current build):
//! - It reads it only when it starts, and then writes it back in full: every
//!   setting it knows filled in, keys it doesn't know dropped.
//! - It doesn't write it when it stops, so a change saved while it runs is
//!   kept and applies at the next start.
//! - It writes bans while running (`bannedAccounts`).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::settings::{FileState, SETTINGS_FILE};
use crate::config::write_atomic;
use crate::error::{Error, IoContext, Result};

/// Ban lists, by the key the server writes and the one its readme names.
const BAN_KEYS: [&str; 2] = ["bannedAccounts", "bans"];
/// Top-level keys that must hold a particular JSON type for the server to
/// start. Anything else is checked by the editor's controls.
const STRING_KEYS: [&str; 6] = [
  "name",
  "saveDirectory",
  "logDirectory",
  "ip",
  "voiceChatMode",
  "gameSettingsPreset",
];
const BOOL_KEYS: [&str; 2] = ["enableVoiceChat", "enableTextChat"];
const ARRAY_KEYS: [&str; 4] = ["tags", "userGroups", "bannedAccounts", "bans"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDocument {
  pub file: FileState,
  /// Why the file can't be edited, when `file` is `Invalid`.
  pub problem: Option<String>,
  /// The file's contents (`None` when missing or unreadable).
  pub document: Option<Value>,
  pub path: String,
}

/// One edit to the file.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Change {
  /// Set the value at `path` (object keys from the top), creating objects
  /// along the way.
  #[serde(rename_all = "camelCase")]
  Set { path: Vec<String>, value: Value },
  /// Lift the ban on the account with this hash.
  #[serde(rename_all = "camelCase")]
  Unban { account_id_hash: String },
}

pub fn file_path(install_dir: &Path) -> PathBuf {
  install_dir.join(SETTINGS_FILE)
}

/// The settings file as it is now.
pub fn read(install_dir: &Path) -> SettingsDocument {
  let path = file_path(install_dir);
  let display = path.display().to_string();
  match load(&path) {
    Ok(Some(document)) => SettingsDocument {
      file: FileState::Ok,
      problem: None,
      document: Some(document),
      path: display,
    },
    Ok(None) => SettingsDocument {
      file: FileState::Missing,
      problem: None,
      document: None,
      path: display,
    },
    Err(problem) => SettingsDocument {
      file: FileState::Invalid,
      problem: Some(problem),
      document: None,
      path: display,
    },
  }
}

/// Apply `changes` to the file on disk (creating it if it doesn't exist
/// yet) and return the result. The previous version is kept next to it as
/// `enshrouded_server.json.bak`.
pub fn save(install_dir: &Path, changes: &[Change]) -> Result<SettingsDocument> {
  let path = file_path(install_dir);
  let existing = load(&path).map_err(|problem| {
    Error::Server(format!(
      "{problem} Fix or delete the file, then try again: saving now would lose whatever is in it."
    ))
  })?;
  let mut document = existing
    .clone()
    .unwrap_or_else(|| Value::Object(Map::new()));
  for change in changes {
    apply(&mut document, change)?;
  }
  validate(&document)?;
  if existing.as_ref() == Some(&document) {
    return Ok(read(install_dir));
  }

  if existing.is_some() {
    let backup = path.with_extension("json.bak");
    std::fs::copy(&path, &backup).at("back up", &path)?;
  }
  write_atomic(&path, &to_server_json(&document)?)?;
  Ok(read(install_dir))
}

/// `Ok(None)` when the file doesn't exist; `Err` describes why it can't be
/// used.
fn load(path: &Path) -> std::result::Result<Option<Value>, String> {
  let text = match std::fs::read_to_string(path) {
    Ok(text) => text,
    Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(None),
    Err(err) => return Err(format!("Couldn't read {SETTINGS_FILE}: {err}.")),
  };
  // Windows editors like to add a byte-order mark.
  match serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}')) {
    Ok(value @ Value::Object(_)) => Ok(Some(value)),
    Ok(_) => Err(format!("{SETTINGS_FILE} doesn't hold a settings object.")),
    Err(err) => Err(format!("{SETTINGS_FILE} isn't valid JSON ({err}).")),
  }
}

fn apply(document: &mut Value, change: &Change) -> Result<()> {
  match change {
    Change::Set { path, value } => {
      let Some((last, parents)) = path.split_last() else {
        return Err(Error::Server("A setting change had no key.".into()));
      };
      let mut node = document;
      for key in parents {
        let Value::Object(map) = node else {
          return Err(not_an_object(path));
        };
        node = map
          .entry(key.clone())
          .or_insert_with(|| Value::Object(Map::new()));
      }
      let Value::Object(map) = node else {
        return Err(not_an_object(path));
      };
      map.insert(last.clone(), value.clone());
    }
    Change::Unban { account_id_hash } => {
      for key in BAN_KEYS {
        if let Some(Value::Array(bans)) = document.get_mut(key) {
          bans.retain(|ban| {
            ban.get("accountIdHash").and_then(Value::as_str) != Some(account_id_hash.as_str())
          });
        }
      }
    }
  }
  Ok(())
}

fn not_an_object(path: &[String]) -> Error {
  Error::Server(format!(
    "Can't set \"{}\": part of that path isn't a group of settings in the file.",
    path.join(".")
  ))
}

/// The checks that keep a saved file from stopping the server. Value ranges
/// and allowed words are enforced by the editor's controls.
fn validate(document: &Value) -> Result<()> {
  let invalid = |message: String| Err(Error::Server(message));
  let Value::Object(map) = document else {
    return invalid("The settings must be a JSON object.".into());
  };
  for (key, value) in map {
    let ok = if STRING_KEYS.contains(&key.as_str()) {
      value.is_string()
    } else if BOOL_KEYS.contains(&key.as_str()) {
      value.is_boolean()
    } else if ARRAY_KEYS.contains(&key.as_str()) {
      value.is_array()
    } else if key == "gameSettings" {
      value.is_object()
    } else {
      true
    };
    if !ok {
      return invalid(format!("\"{key}\" has the wrong type of value."));
    }
  }
  if let Some(name) = map.get("name").and_then(Value::as_str) {
    if name.trim().is_empty() {
      return invalid("The server needs a name.".into());
    }
  }
  if let Some(slots) = map.get("slotCount") {
    if !slots.as_u64().is_some_and(|n| (1..=16).contains(&n)) {
      return invalid("Player slots must be a whole number from 1 to 16.".into());
    }
  }
  if let Some(port) = map.get("queryPort") {
    if !port.as_u64().is_some_and(|p| (1..=65535).contains(&p)) {
      return invalid("The query port must be a whole number from 1 to 65535.".into());
    }
  }
  if let Some(ip) = map.get("ip").and_then(Value::as_str) {
    if ip.trim().parse::<std::net::IpAddr>().is_err() {
      return invalid(format!("\"{ip}\" isn't an IP address."));
    }
  }
  if let Some(Value::Array(tags)) = map.get("tags") {
    if !tags.iter().all(Value::is_string) {
      return invalid("Server list tags must be words.".into());
    }
  }
  if let Some(Value::Object(game)) = map.get("gameSettings") {
    for (key, value) in game {
      let ok = match value {
        Value::Number(n) => n.as_f64().is_some_and(f64::is_finite),
        Value::Bool(_) | Value::String(_) => true,
        _ => false,
      };
      if !ok {
        return invalid(format!(
          "World setting \"{key}\" has the wrong type of value."
        ));
      }
    }
  }
  if let Some(Value::Array(groups)) = map.get("userGroups") {
    let mut names = std::collections::HashSet::new();
    for group in groups {
      let Some(name) = group.get("name").and_then(Value::as_str) else {
        return invalid("Every role needs a name.".into());
      };
      if name.trim().is_empty() {
        return invalid("Every role needs a name.".into());
      }
      if !names.insert(name.to_lowercase()) {
        return invalid(format!("There are two roles called \"{name}\"."));
      }
      if group.get("password").is_some_and(|p| !p.is_string()) {
        return invalid(format!("The password of role \"{name}\" must be text."));
      }
    }
  }
  Ok(())
}

/// Pretty-printed with tabs, like the server writes it.
fn to_server_json(document: &Value) -> Result<Vec<u8>> {
  use serde::Serialize as _;
  let mut out = Vec::new();
  let formatter = serde_json::ser::PrettyFormatter::with_indent(b"\t");
  let mut serializer = serde_json::Serializer::with_formatter(&mut out, formatter);
  document.serialize(&mut serializer)?;
  out.push(b'\n');
  Ok(out)
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  fn set(path: &[&str], value: Value) -> Change {
    Change::Set {
      path: path.iter().map(ToString::to_string).collect(),
      value,
    }
  }

  #[test]
  fn changes_keep_everything_else_in_place() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    let original = "{\n\t\"name\": \"Old\",\n\t\"aSettingFromTheFuture\": [1, 2],\n\t\"gameSettingsPreset\": \"Default\",\n\t\"gameSettings\": {\n\t\t\"playerHealthFactor\": 1,\n\t\t\"newWorldSetting\": \"Keep\"\n\t},\n\t\"bannedAccounts\": [{ \"accountIdHash\": \"a\" }, { \"accountIdHash\": \"b\" }]\n}\n";
    std::fs::write(file_path(dir.path()), original).at("write", dir.path())?;

    let saved = save(
      dir.path(),
      &[
        set(&["name"], json!("Embervale")),
        set(&["gameSettingsPreset"], json!("Custom")),
        set(&["gameSettings", "playerHealthFactor"], json!(1.5)),
        Change::Unban {
          account_id_hash: "a".into(),
        },
      ],
    )?;
    let doc = saved.document.unwrap_or_default();
    assert_eq!(doc["name"], "Embervale");
    assert_eq!(doc["aSettingFromTheFuture"], json!([1, 2]));
    assert_eq!(doc["gameSettings"]["playerHealthFactor"], 1.5);
    assert_eq!(doc["gameSettings"]["newWorldSetting"], "Keep");
    assert_eq!(doc["bannedAccounts"], json!([{ "accountIdHash": "b" }]));
    let keys: Vec<&String> = doc
      .as_object()
      .map(|m| m.keys().collect())
      .unwrap_or_default();
    assert_eq!(
      keys,
      [
        "name",
        "aSettingFromTheFuture",
        "gameSettingsPreset",
        "gameSettings",
        "bannedAccounts"
      ],
      "key order is kept"
    );

    let written = std::fs::read_to_string(file_path(dir.path())).at("read", dir.path())?;
    assert!(
      written.starts_with("{\n\t\"name\": \"Embervale\""),
      "tab-indented like the server's"
    );
    let backup = std::fs::read_to_string(dir.path().join("enshrouded_server.json.bak"))
      .at("read", dir.path())?;
    assert_eq!(backup, original);
    Ok(())
  }

  #[test]
  fn creates_the_file_when_missing() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    assert_eq!(read(dir.path()).file, FileState::Missing);
    let saved = save(
      dir.path(),
      &[set(
        &["gameSettings", "dayTimeDuration"],
        json!(3_600_000_000_000_u64),
      )],
    )?;
    assert_eq!(saved.file, FileState::Ok);
    assert_eq!(
      saved.document.unwrap_or_default()["gameSettings"]["dayTimeDuration"],
      3_600_000_000_000_u64
    );
    Ok(())
  }

  #[test]
  fn refuses_what_would_stop_the_server() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    for bad in [
      set(&["slotCount"], json!(17)),
      set(&["queryPort"], json!("15637")),
      set(&["name"], json!("  ")),
      set(&["ip"], json!("localhost")),
      set(&["tags"], json!(["English", 3])),
      set(&["gameSettings", "playerHealthFactor"], json!(null)),
      set(
        &["userGroups"],
        json!([{ "name": "Admin" }, { "name": "admin" }]),
      ),
    ] {
      assert!(save(dir.path(), &[bad]).is_err());
    }
    assert_eq!(
      read(dir.path()).file,
      FileState::Missing,
      "nothing was written"
    );
    Ok(())
  }

  #[test]
  fn a_broken_file_is_not_overwritten() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    std::fs::write(file_path(dir.path()), "{ \"name\": ").at("write", dir.path())?;
    assert_eq!(read(dir.path()).file, FileState::Invalid);
    assert!(save(dir.path(), &[set(&["name"], json!("x"))]).is_err());
    assert_eq!(
      std::fs::read_to_string(file_path(dir.path())).at("read", dir.path())?,
      "{ \"name\": "
    );
    Ok(())
  }
}
