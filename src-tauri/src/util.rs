use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

/// A path as a string for the UI.
pub fn display(path: &Path) -> String {
  path.to_string_lossy().into_owned()
}

/// Current time in Unix seconds.
pub fn now() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_or(0, |d| d.as_secs())
}

/// Current time in Unix milliseconds.
pub fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}
