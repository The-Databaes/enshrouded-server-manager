use std::path::Path;

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

pub type Result<T, E = Error> = std::result::Result<T, E>;

/// Every error a command can return. Serialised to the frontend as
/// `{ kind, message }` so the UI can branch on `kind` and show `message`.
#[derive(Debug, thiserror::Error)]
pub enum Error {
  #[error("{context}: {source}")]
  Io {
    context: String,
    #[source]
    source: std::io::Error,
  },
  #[error("Download failed: {0}")]
  Http(#[from] reqwest::Error),
  #[error("Couldn't unpack the SteamCMD archive: {0}")]
  Zip(#[from] zip::result::ZipError),
  #[error("Couldn't save the config file: {0}")]
  Json(#[from] serde_json::Error),
  #[error(transparent)]
  Tauri(#[from] tauri::Error),
  #[error("{0}")]
  InvalidPath(String),
  #[error("Another SteamCMD task is already running.")]
  Busy,
  #[error("Cancelled.")]
  Cancelled,
  #[error("{0}")]
  Unsupported(String),
  #[error("{0}")]
  SteamCmd(String),
  /// Starting, stopping or talking to the server failed.
  #[error("{0}")]
  Server(String),
  /// Not possible while the server is running (or because one already is).
  #[error("{0}")]
  ServerRunning(String),
  /// Updating the manager itself failed.
  #[error("{0}")]
  Update(String),
  /// The update server couldn't be reached (offline, timed out, a proxy).
  #[error("{0}")]
  UpdateOffline(String),
  /// Nothing has been published at the update endpoint yet.
  #[error("{0}")]
  UpdateNoRelease(String),
  /// The download didn't match its signature.
  #[error("{0}")]
  UpdateVerification(String),
}

impl Error {
  const fn kind(&self) -> &'static str {
    match self {
      Self::Io { .. } => "io",
      Self::Http(_) => "http",
      Self::Zip(_) => "archive",
      Self::Json(_) => "config",
      Self::Tauri(_) => "tauri",
      Self::InvalidPath(_) => "invalidPath",
      Self::Busy => "busy",
      Self::Cancelled => "cancelled",
      Self::Unsupported(_) => "unsupported",
      Self::SteamCmd(_) => "steamcmd",
      Self::Server(_) => "server",
      Self::ServerRunning(_) => "serverRunning",
      Self::Update(_) => "update",
      Self::UpdateOffline(_) => "updateOffline",
      Self::UpdateNoRelease(_) => "updateNoRelease",
      Self::UpdateVerification(_) => "updateVerification",
    }
  }
}

impl Serialize for Error {
  fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
    let mut s = serializer.serialize_struct("Error", 2)?;
    s.serialize_field("kind", self.kind())?;
    s.serialize_field("message", &self.to_string())?;
    s.end()
  }
}

/// Attach a human-readable "what were we doing" to `io::Error`s, which on
/// their own only say things like "Access is denied. (os error 5)".
pub trait IoContext<T> {
  fn context(self, what: impl FnOnce() -> String) -> Result<T>;
  fn at(self, verb: &str, path: &Path) -> Result<T>;
}

impl<T> IoContext<T> for std::io::Result<T> {
  fn context(self, what: impl FnOnce() -> String) -> Result<T> {
    self.map_err(|source| Error::Io {
      context: what(),
      source,
    })
  }

  fn at(self, verb: &str, path: &Path) -> Result<T> {
    self.context(|| format!("Couldn't {verb} {}", path.display()))
  }
}
