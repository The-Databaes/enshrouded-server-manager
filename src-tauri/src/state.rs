use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use tokio_util::sync::CancellationToken;

use crate::config::ConfigStore;
use crate::error::{Error, IoContext, Result};
use crate::server::runtime::{Events, ServerRuntime};

/// Name of the folder in the user's home directory that holds everything the
/// app stores: `config.json`, the app-managed SteamCMD and (by default) the
/// server files. One place, the same on every machine.
pub const DATA_DIR_NAME: &str = ".enshrouded-server-manager";

/// Everything the commands share, registered with `app.manage` on startup.
pub struct AppState {
  /// `~/.enshrouded-server-manager` (see [`DATA_DIR_NAME`]).
  pub data_dir: PathBuf,
  pub config: ConfigStore,
  /// SteamCMD jobs (its own updates, and installing/updating the server
  /// files) run one at a time.
  pub steamcmd_job: JobSlot,
  /// The dedicated server process, when it runs.
  pub runtime: ServerRuntime,
}

impl AppState {
  /// `events` receives the running server's status and console output.
  pub fn load(data_dir: PathBuf, events: Arc<dyn Events>) -> Result<Self> {
    std::fs::create_dir_all(&data_dir).at("create", &data_dir)?;
    Ok(Self {
      config: ConfigStore::load(&data_dir)?,
      data_dir,
      steamcmd_job: JobSlot::default(),
      runtime: ServerRuntime::new(events),
    })
  }

  /// Where SteamCMD goes when the app downloads it.
  pub fn managed_steamcmd_dir(&self) -> PathBuf {
    self.data_dir.join("steamcmd")
  }
}

/// Allows one long-running task at a time and lets another command cancel it.
#[derive(Default)]
pub struct JobSlot(Mutex<Option<CancellationToken>>);

impl JobSlot {
  /// Claim the slot, or fail with [`Error::Busy`]. The slot is released when
  /// the returned guard is dropped, however the task ends.
  pub fn start(&self) -> Result<JobGuard<'_>> {
    let mut slot = self.lock();
    if slot.is_some() {
      return Err(Error::Busy);
    }
    let token = CancellationToken::new();
    *slot = Some(token.clone());
    Ok(JobGuard { slot: self, token })
  }

  pub fn cancel(&self) {
    if let Some(token) = self.lock().as_ref() {
      token.cancel();
    }
  }

  pub fn is_busy(&self) -> bool {
    self.lock().is_some()
  }

  fn lock(&self) -> MutexGuard<'_, Option<CancellationToken>> {
    self.0.lock().unwrap_or_else(PoisonError::into_inner)
  }
}

pub struct JobGuard<'a> {
  slot: &'a JobSlot,
  pub token: CancellationToken,
}

impl Drop for JobGuard<'_> {
  fn drop(&mut self) {
    *self.slot.lock() = None;
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn job_slot_is_exclusive_and_released_on_drop() {
    let slot = JobSlot::default();
    let job = slot.start();
    assert!(job.is_ok());
    assert!(matches!(slot.start(), Err(Error::Busy)));

    slot.cancel();
    assert!(job.as_ref().is_ok_and(|j| j.token.is_cancelled()));

    drop(job);
    assert!(!slot.is_busy());
    assert!(slot.start().is_ok());
  }
}
